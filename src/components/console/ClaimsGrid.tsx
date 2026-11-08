"use client";

import {
  CellStyleModule,
  ClientSideRowModelApiModule,
  ClientSideRowModelModule,
  ColumnApiModule,
  CsvExportModule,
  CustomFilterModule,
  HighlightChangesModule,
  LocaleModule,
  ModuleRegistry,
  QuickFilterModule,
  RowApiModule,
  RowSelectionModule,
  RowStyleModule,
  ScrollApiModule,
  TooltipModule,
  ValidationModule,
  type CellFocusedEvent,
  type CellKeyDownEvent,
  type ColDef,
  type FilterChangedEvent,
  type FirstDataRenderedEvent,
  type FocusGridInnerElementParams,
  type GetRowIdParams,
  type GridApi,
  type GridReadyEvent,
  type IRowNode,
  type IsFullWidthRowParams,
  type ModelUpdatedEvent,
  type PostSortRowsParams,
  type RowClassParams,
  type RowClickedEvent,
  type RowHeightParams,
} from "ag-grid-community";
import { AgGridReact, type CustomCellRendererProps } from "ag-grid-react";
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { isPreCheck, type ClaimRow } from "@/app/console/_lib/view";
import {
  AmountCell,
  CardRow,
  ChecksCell,
  ChecksTooltip,
  ClaimCell,
  GroupRow,
  PayerCell,
  PayoutCell,
  PhotoTooltip,
  sent,
  TimeCell,
  TimelineTooltip,
  verdictLabel,
  VerdictCell,
  type GridContext,
  type GridRow,
  type GroupStats,
  type GroupTotal,
} from "./cells";
import { SkeletonGrid } from "./ConsoleSkeleton";
import { ClaimFilter, claimFilterPass, DecisionFilter, decisionFilterPass, reasonGroup, reasonKey, type DecisionModel } from "./DecisionFilter";
import { formatDate } from "./format";
import { gridTheme } from "./gridTheme";
import "./claims-grid.css";

// Community modules only (no Enterprise, no licence): the Claim and Verdict columns' faceted filters, the quick filter
// behind search, CSV export, the column API the tabs use to set the Verdict filter, photo tooltips and the payout cell
// flash. Group by is built from full-width rows, which are Community too.
ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  ClientSideRowModelApiModule,
  RowApiModule,
  RowSelectionModule,
  RowStyleModule,
  ScrollApiModule,
  CellStyleModule,
  TooltipModule,
  HighlightChangesModule,
  CustomFilterModule,
  QuickFilterModule,
  CsvExportModule,
  ColumnApiModule,
  LocaleModule,
  ...(process.env.NODE_ENV !== "production" ? [ValidationModule] : []),
]);

// Below this width the grid shows one card per claim (phones, narrow windows).
export const CARD_BELOW = 720;
// Columns that come and go with the grid's width (the evidence panel takes 452px). The rest need claim 220, checks 136
// and amount 96, plus the verdict: at least 260 (144 in the homepage's still, which keeps columns down to 592px). Each
// optional column is added, in order, while it fits; in the queue only while the verdict keeps 360px, room for a reason
// like "Couldn't tell if both photos show the same item" beside its pill: the reason is what a reviewer reads first.
// The verdict takes every pixel the other columns leave, so the amount always closes the row on the grid's right edge
// (where a group's total sits) and a reason runs whole rather than truncating beside an empty band. Beside the open
// panel the payout state stays (it is the money's question) and the PayPal account goes first.
const VERDICT_MIN = { queue: 260, still: 144 };
const VERDICT_WANT = { queue: 360, still: 144 };
const BASE = 220 + 136 + 96;
const OPTIONAL = {
  queue: { time: 104, payoutStatus: 148, payer: 132 } as Record<string, number>,
  still: { time: 88, payoutStatus: 112, payer: 132 } as Record<string, number>,
};
const ORDER = { queue: ["payoutStatus", "time", "payer"], still: ["payoutStatus", "time", "payer"] };

function hiddenAt(width: number, still: boolean): Set<string> {
  const mode = still ? "still" : "queue";
  let room = width - BASE - VERDICT_WANT[mode];
  const hidden = new Set<string>();
  for (const id of ORDER[mode]) {
    if ((still || !hidden.size) && room >= OPTIONAL[mode][id]) room -= OPTIONAL[mode][id];
    else hidden.add(id);
  }
  return hidden;
}

export type GroupBy = "none" | "reason" | "code" | "day";

/** A claim's group under a Group by: its key (what sorts the groups) and its heading. */
function groupOf(r: ClaimRow, by: GroupBy): { key: string; label: string } {
  if (by === "reason") return { key: reasonGroup(r), label: reasonGroup(r) };
  if (by === "code") return r.code ? { key: r.code, label: `Code ${r.code}` } : { key: "~", label: "No code" };
  const day = r.createdAt.slice(0, 10);
  return { key: day, label: `Filed ${formatDate(day)}` };
}

const DECISION_ORDER: Record<ClaimRow["decision"], number> = { held: 0, pending: 1, paid: 2, rejected: 3, blocked: 4 };

export interface GridTotals {
  count: number;
  approvedCents: number;
  sentCents: number;
}

export interface ClaimsGridHandle {
  /** Puts keyboard focus back on a claim's row (after the panel closes). */
  focusRow(id: string): void;
  /** Puts keyboard focus on the first claim row (↓ or j from outside the grid). */
  focusFirst(): void;
  /** The claim whose row has keyboard focus, if any (A and R act on it). */
  focusedRowId(): string | null;
  /** The claims the grid shows, in its order: filters, sort and groups applied. */
  displayedIds(): string[];
  /** Downloads the claims the grid shows as CSV. */
  exportCsv(): void;
  /** Closes an open column filter, returning focus to its header. False when none was open. */
  closeFilter(): boolean;
  /** Sorts as the column headers would (card rows have no header to click). */
  sortBy(order: SortOrder): void;
}

export type SortOrder = "newest" | "oldest" | "amount";

export interface ClaimsGridProps {
  rows: ClaimRow[];
  /** The grid's accessible name ("Claims for X-VESOLJE Nursing Pillows"). */
  label?: string;
  /** The claim whose evidence is open: its row is selected (a surface step up, ink edge). */
  openId: string | null;
  onOpen: (id: string) => void;
  /** A claim id in a row's reason was clicked: open that claim (in the list that shows it). */
  onOpenLinked?: (id: string) => void;
  /** A row took keyboard focus (↑/↓): the panel follows it while open. */
  onFocusRow?: (id: string) => void;
  /** Fill the parent's height (laptops) instead of growing with the rows. */
  fill?: boolean;
  /** Read only (the homepage preview): no keyboard opening, no tooltips, no filters. */
  still?: boolean;
  /** Sort oldest first (the held tab: the longest waiting leads) instead of newest first. */
  oldestFirst?: boolean;
  /** Search words, matched by the grid's quick filter against the claim id, code, PayPal account and reason. */
  search?: string;
  /** The Verdict column's filter (the status tabs set it); onDecisionFilter hears it change from the column's menu. */
  decisionFilter?: DecisionModel | null;
  onDecisionFilter?: (model: DecisionModel | null) => void;
  groupBy?: GroupBy;
  /** What the grid shows after its filters: the claims, the money they approved and the money sent. */
  onShown?: (totals: GridTotals) => void;
  /** The first rows are drawn (the skeleton has gone). */
  onReady?: () => void;
  className?: string;
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A tiny store for the group rows' live totals: they read it, so a filter change redraws only their numbers. */
function groupStore(): GroupStats & { set(next: Map<string, GroupTotal>): void } {
  let map = new Map<string, GroupTotal>();
  const listeners = new Set<() => void>();
  return {
    get: (key) => map.get(key),
    subscribe(on) {
      listeners.add(on);
      return () => listeners.delete(on);
    },
    set(next) {
      map = next;
      listeners.forEach((l) => l());
    },
  };
}

/** Full-width rows: a group's heading, or a whole claim as a card. */
function FullWidthRow(p: CustomCellRendererProps<GridRow, unknown, GridContext>) {
  if (p.data?.group) return <GroupRow {...p} />;
  return <CardRow {...p} />;
}

const isClaim = (n: IRowNode<GridRow> | null | undefined) => Boolean(n?.data && !n.data.group && !n.rowPinned);
function firstClaimIndex(grid: GridApi<GridRow>): number {
  for (let i = 0; i < grid.getDisplayedRowCount(); i++) if (isClaim(grid.getDisplayedRowAtIndex(i))) return i;
  return -1;
}
const rowId = (p: GetRowIdParams<GridRow>) => p.data.id;
const isGroupNode = (n: IRowNode<GridRow>) => Boolean(n.data?.group);
const noTab = () => false;
// What a screen reader hears on a focused row: what Enter does here, not AG Grid's "Press SPACE to select this row".
const LOCALE = { ariaRowSelect: "Enter opens this claim", ariaRowDeselect: "This claim is open", ariaRowToggleSelection: "Enter opens this claim" };
const ROW_SELECTION = { mode: "singleRow", checkboxes: false, enableClickSelection: false, isRowSelectable: (n: IRowNode<GridRow>) => isClaim(n) } as const;

/** Where the page scrolls rather than the grid (autoHeight: card rows, short windows), keeps the focused row on screen.
 * AG Grid's ensureIndexVisible only scrolls the grid's own viewport, which under autoHeight never scrolls. */
function keepInView(root: HTMLElement | null, id: string) {
  const row = root?.querySelector<HTMLElement>(`.ag-row[row-id="${CSS.escape(id)}"]`);
  if (!row) return;
  const r = row.getBoundingClientRect();
  if (r.top < 0 || r.bottom > window.innerHeight) row.scrollIntoView({ block: "nearest" });
}

export const ClaimsGrid = forwardRef<ClaimsGridHandle, ClaimsGridProps>(function ClaimsGrid(
  { rows, label, openId, onOpen, onOpenLinked, onFocusRow, fill = false, still = false, oldestFirst = false, search = "", decisionFilter, onDecisionFilter, groupBy = "none", onShown, onReady, className },
  ref,
) {
  const wrap = useRef<HTMLDivElement>(null);
  const api = useRef<GridApi<GridRow> | null>(null);
  // Unknown until measured, so the grid mounts in its final layout (cards or columns) and never jumps.
  const [width, setWidth] = useState<number | null>(null);
  // AG Grid paints nothing until its script runs; the skeleton holds the grid's footprint until the first rows.
  const [ready, setReady] = useState(false);
  const [animate] = useState(() => !reducedMotion());
  const [stats] = useState(groupStore);
  // The header whose filter button opened the popup that's up: Esc returns focus there.
  const filterHeader = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const note = (e: Event) => {
      const header = (e.target as Element | null)?.closest?.<HTMLElement>(".ag-header-cell");
      if (header && (e.target as Element).closest(".ag-header-cell-filter-button, .ag-header-cell-menu-button")) filterHeader.current = header;
    };
    el.addEventListener("pointerdown", note, true);
    el.addEventListener("keydown", note, true);
    return () => {
      el.removeEventListener("pointerdown", note, true);
      el.removeEventListener("keydown", note, true);
    };
  }, []);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cards = width !== null && width < (still ? BASE + VERDICT_MIN.still : CARD_BELOW);
  const hidden = useMemo(() => (width === null ? new Set<string>() : hiddenAt(width, still)), [width, still]);

  // Group by: one heading row per group, placed by postSortRows above its claims, in the groups' order.
  const grouping = still ? "none" : groupBy;
  const groupRef = useRef(grouping);
  const order = useRef(new Map<string, number>());
  // The groups folded to their heading: postSortRows leaves their claims out. A new Group by starts unfolded.
  const folded = useRef(new Set<string>());
  const rowData = useMemo<GridRow[]>(() => {
    if (groupRef.current !== grouping) folded.current = new Set();
    groupRef.current = grouping;
    if (grouping === "none") return rows;
    const heads = new Map<string, { label: string; n: number }>();
    for (const r of rows) {
      const g = groupOf(r, grouping);
      heads.set(g.key, { label: g.label, n: (heads.get(g.key)?.n ?? 0) + 1 });
    }
    // Reasons by size (the common one first), codes A to Z, days newest first.
    const keys = [...heads.keys()].sort((a, b) =>
      grouping === "reason" ? heads.get(b)!.n - heads.get(a)!.n || a.localeCompare(b) : grouping === "day" ? b.localeCompare(a) : a.localeCompare(b),
    );
    order.current = new Map(keys.map((k, i) => [k, i]));
    const groupRows = keys.map((key) => ({ ...rows[0], id: `group:${key}`, group: { key, label: heads.get(key)!.label } }));
    return [...groupRows, ...rows];
  }, [rows, grouping]);

  // Every row of the recall gets the same strip length: the most pre-checks and model answers any row has.
  const slots = useMemo(() => {
    let pre = 0;
    let model = 0;
    for (const r of rows) {
      if (!r.bars) continue;
      pre = Math.max(pre, r.bars.filter((b) => isPreCheck(b.id)).length);
      model = Math.max(model, r.bars.filter((b) => !isPreCheck(b.id)).length);
    }
    return { pre, model };
  }, [rows]);
  const linked = useRef(onOpenLinked);
  useLayoutEffect(() => {
    linked.current = onOpenLinked;
  });
  const context = useMemo<GridContext>(
    () => ({ stacked: still, slots, groups: stats, open: still ? undefined : (id: string) => linked.current?.(id) }),
    [still, slots, stats],
  );

  useImperativeHandle(ref, () => ({
    focusRow(id) {
      const grid = api.current;
      const node = grid?.getRowNode(id);
      if (!grid || node?.rowIndex == null) return;
      grid.ensureIndexVisible(node.rowIndex);
      grid.setFocusedCell(node.rowIndex, "createdAt");
    },
    focusFirst() {
      const grid = api.current;
      if (!grid) return;
      for (let i = 0; i < grid.getDisplayedRowCount(); i++) {
        if (!isClaim(grid.getDisplayedRowAtIndex(i))) continue;
        grid.ensureIndexVisible(i);
        grid.setFocusedCell(i, "createdAt");
        return;
      }
    },
    focusedRowId() {
      const cell = api.current?.getFocusedCell();
      if (!cell || cell.rowPinned) return null;
      const node = api.current?.getDisplayedRowAtIndex(cell.rowIndex);
      return isClaim(node) ? (node!.data!.id ?? null) : null;
    },
    displayedIds() {
      const ids: string[] = [];
      api.current?.forEachNodeAfterFilterAndSort((n) => isClaim(n) && ids.push(n.data!.id));
      return ids;
    },
    sortBy(order) {
      const [colId, sort] = order === "amount" ? ["amount", "desc"] : ["createdAt", order === "oldest" ? "asc" : "desc"];
      api.current?.applyColumnState({ state: [{ colId, sort: sort as "asc" | "desc" }], defaultState: { sort: null } });
    },
    closeFilter() {
      const popup = document.querySelector(".ag-popup .ag-filter, .ag-popup .ag-menu");
      if (!popup) return false;
      api.current?.hidePopupMenu();
      api.current?.hideColumnFilter();
      filterHeader.current?.focus();
      return true;
    },
    exportCsv() {
      api.current?.exportDataAsCsv({
        fileName: `remedy-claims-${new Date().toISOString().slice(0, 10)}.csv`,
        allColumns: true,
        skipPinnedBottom: true,
        columnKeys: ["createdAt", "filedAt", "code", "decision", "reason", "checks", "time", "toPay", "payer", "payoutStatus", "amount"],
        shouldRowBeSkipped: (p) => Boolean(p.node.data?.group),
        processHeaderCallback: (p) => CSV_HEADERS[p.column.getColId()] ?? p.column.getColDef().headerName ?? "",
        processCellCallback: (p) => csvCell(p.column.getColId(), p.node?.data),
      });
    },
  }));

  // Tab into the grid lands on a row (the open claim's, else the first), not on each column header in turn; ↑ from the
  // first row still reaches the headers to sort.
  const openRef = useRef(openId);
  useEffect(() => {
    openRef.current = openId;
  }, [openId]);

  // The panel owns the selection: closing it clears the highlight.
  useEffect(() => {
    const grid = api.current;
    if (!grid) return;
    if (!openId) grid.deselectAll();
    else grid.getRowNode(openId)?.setSelected(true, true);
  }, [openId, rowData]);

  // The tabs' filter, set on the Verdict column: the column's menu shows the same choice.
  const filterJson = JSON.stringify(decisionFilter ?? null);
  useEffect(() => {
    const grid = api.current;
    if (!grid || still) return;
    if (JSON.stringify(grid.getColumnFilterModel("decision") ?? null) === filterJson) return;
    grid.setColumnFilterModel("decision", JSON.parse(filterJson)).then(() => grid.onFilterChanged());
  }, [filterJson, still, ready]);

  // A new tab is a new list: a row index kept from the last one (focus on its fourth row) would put the keyboard, and
  // A and R, on whichever claim now sits there. Focus goes to the open claim if this list still shows it, else to the
  // new list's first claim; with the keyboard outside the grid it is simply cleared, so j starts at the top.
  const listKey = `${filterJson}|${oldestFirst}`;
  const lastList = useRef(listKey);
  useEffect(() => {
    const grid = api.current;
    if (!grid || still || lastList.current === listKey) return;
    lastList.current = listKey;
    const inGrid = Boolean(wrap.current?.contains(document.activeElement));
    // After the filter and the sort have run (both apply on the grid's next pass).
    const t = window.setTimeout(() => {
      if (grid.isDestroyed()) return;
      if (!inGrid) return grid.clearFocusedCell();
      const open = latest.current.openId ? grid.getRowNode(latest.current.openId) : null;
      const at = open?.displayed && open.rowIndex != null ? open.rowIndex : firstClaimIndex(grid);
      if (at < 0) return grid.clearFocusedCell();
      grid.ensureIndexVisible(at);
      grid.setFocusedCell(at, "createdAt");
    }, 0);
    return () => window.clearTimeout(t);
  }, [listKey, still]);

  // AG Grid leaves its grid role unnamed: name it for the recall, so a screen reader says which claims these are.
  useEffect(() => {
    const el = wrap.current?.querySelector("[role=grid], [role=treegrid]");
    if (el && label) el.setAttribute("aria-label", label);
  }, [label, ready, cards]);

  // A card layout has no header row drawn: keep it out of the accessibility tree too.
  useEffect(() => {
    const header = wrap.current?.querySelector(".ag-header");
    if (!header) return;
    if (cards) header.setAttribute("aria-hidden", "true");
    else header.removeAttribute("aria-hidden");
  }, [cards, ready]);

  const columns = useMemo<ColDef<GridRow>[]>(() => {
    const all: ColDef<GridRow>[] = [
      {
        colId: "createdAt",
        // The second line's time is UTC (cells.tsx): said once here, so every row's line fits the column.
        headerName: "Claim · UTC",
        headerTooltip: still ? undefined : "The claim, the code on its tag, and when it was filed (UTC).",
        field: "createdAt",
        cellRenderer: ClaimCell,
        width: 220,
        pinned: "left",
        lockPinned: true,
        suppressMovable: true,
        sortable: !still,
        // The queue is newest first, the held tab oldest first; the homepage's still keeps the order its rows come in
        // (curated in preview.ts). A header click flips the order, with no unsorted step between.
        sort: still ? undefined : oldestFirst ? "asc" : "desc",
        sortingOrder: ["desc", "asc"],
        // Claims filed in the same minute: the claim id breaks the tie, so a run of identical photos and codes doesn't
        // sit together.
        comparator: (a: string, b: string, na, nb) => a.localeCompare(b) || (na.data?.id ?? "").localeCompare(nb.data?.id ?? ""),
        // Search already finds ids and codes; the column's own filter picks codes and days, with their counts.
        filter: still ? undefined : { component: ClaimFilter, doesFilterPass: claimFilterPass },
        getQuickFilterText: (p) => (p.data ? `${p.data.id} ${p.data.code ?? ""} ${p.data.payer} ${p.data.reason} ${p.data.note ?? ""}` : ""),
        tooltip: (p) => (!still && p.data?.photos.length ? p.data.id : undefined),
        tooltipComponent: PhotoTooltip,
      },
      {
        colId: "decision",
        headerName: "Verdict",
        // The pill and its line: AG Grid redraws (and flashes) a cell only when its value changes, and a held claim's
        // line changes on its own (a refused payout).
        valueGetter: (p) => (p.data ? `${p.data.decision} ${p.data.note ?? ""}` : null),
        cellRenderer: VerdictCell,
        // All the spare width: the reason is what a reviewer reads first, and the amount stays on the right edge.
        flex: 1,
        minWidth: still ? VERDICT_MIN.still : VERDICT_MIN.queue,
        sortable: !still,
        sortingOrder: ["asc", "desc", null],
        comparator: (_a, _b, na, nb) =>
          na.data && nb.data ? DECISION_ORDER[na.data.decision] - DECISION_ORDER[nb.data.decision] || reasonKey(na.data).localeCompare(reasonKey(nb.data)) : 0,
        filter: still ? undefined : { component: DecisionFilter, doesFilterPass: decisionFilterPass },
        enableCellChangeFlash: true,
        // The flash is the paid colour only when the claim became paid; any other change (a refused approve, a reject)
        // flashes neutral, since no money moved (claims-grid.css).
        cellClass: (p) => (p.data?.decision === "paid" ? undefined : "flash-neutral"),
        getQuickFilterText: () => "",
      },
      {
        colId: "checks",
        headerName: "Checks",
        headerTooltip: still ? undefined : "The pre-checks, then the photo check's answers. Filled passed, half held, slashed failed, outline waiting.",
        cellRenderer: ChecksCell,
        width: 136,
        tooltip: (p) => (!still && p.data?.bars ? p.data.id : undefined),
        tooltipComponent: ChecksTooltip,
        getQuickFilterText: () => "",
      },
      {
        colId: "time",
        headerName: "Answered in",
        headerTooltip: still ? undefined : "How long the photo check took to answer. Hover a row for every step to the payout.",
        cellRenderer: TimeCell,
        width: OPTIONAL[still ? "still" : "queue"].time,
        type: "rightAligned",
        tooltip: (p) => (!still && p.data?.timeline ? p.data.id : undefined),
        tooltipComponent: TimelineTooltip,
        sortable: !still,
        valueGetter: (p) => p.data?.modelSec ?? null,
        // Claims with no time last, whichever way.
        comparator: (a: number | null, b: number | null, _na, _nb, desc) =>
          a === null ? (b === null ? 0 : desc ? -1 : 1) : b === null ? (desc ? 1 : -1) : a - b,
        getQuickFilterText: () => "",
      },
      {
        colId: "payer",
        headerName: "PayPal",
        field: "payer",
        cellRenderer: PayerCell,
        width: 132,
        getQuickFilterText: () => "",
      },
      {
        colId: "payoutStatus",
        headerName: "Payout",
        valueGetter: (p) => (p.data ? (p.data.payoutFailedAt ? `not sent ${p.data.payoutFailedAt}` : p.data.payoutStatus) : null),
        cellRenderer: PayoutCell,
        width: OPTIONAL[still ? "still" : "queue"].payoutStatus,
        enableCellChangeFlash: true,
        cellClass: (p) => (p.data?.payoutStatus === "SUCCESS" ? undefined : "flash-neutral"),
        getQuickFilterText: () => "",
      },
      {
        colId: "amount",
        headerName: "Amount",
        field: "cents",
        cellRenderer: AmountCell,
        width: 96,
        // Pinned in the still; in the queue the last column, on the grid's right edge, under a group's total.
        pinned: still ? "right" : undefined,
        lockPinned: true,
        suppressMovable: true,
        sortable: !still,
        type: "rightAligned",
        getQuickFilterText: () => "",
      },
      // For the CSV only: the claim's code, when it was filed and the reason as their own columns.
      { colId: "code", headerName: "Code", valueGetter: (p) => p.data?.code ?? "", hide: true },
      { colId: "toPay", headerName: "Photos to payout (s)", valueGetter: (p) => p.data?.toPay ?? null, hide: true },
      { colId: "filedAt", headerName: "Filed (UTC)", field: "createdAt", hide: true },
      { colId: "reason", headerName: "Reason", valueGetter: (p) => (p.data ? reasonKey(p.data) : ""), hide: true },
    ];
    return all.map((c) => ({
      sortable: false,
      resizable: !still && !c.pinned,
      suppressMovable: still,
      suppressHeaderMenuButton: true,
      ...c,
      hide: c.hide || hidden.has(c.colId ?? ""),
    }));
  }, [hidden, still, oldestFirst]);

  // After every filter, sort or data change: the totals under the grid, each group's count and sum, and the count the
  // queue's footer gives.
  const measure = (grid: GridApi<GridRow>) => {
    let count = 0;
    let approvedCents = 0;
    let sentCents = 0;
    const groups = new Map<string, GroupTotal>();
    grid.forEachNodeAfterFilter((n) => {
      const r = n.data;
      if (!r || r.group) return;
      count++;
      if (r.decision === "paid") approvedCents += r.cents ?? 0;
      if (sent(r)) sentCents += r.cents ?? 0;
      if (groupRef.current !== "none") {
        const key = groupOf(r, groupRef.current).key;
        const g = groups.get(key) ?? { count: 0, cents: 0, mix: {}, folded: folded.current.has(key) };
        groups.set(key, {
          ...g,
          count: g.count + 1,
          // Approved money only, as the footer counts it: a held claim's refund isn't owed until a person approves it.
          cents: g.cents + (r.decision === "paid" ? (r.cents ?? 0) : 0),
          mix: { ...g.mix, [r.decision]: (g.mix[r.decision] ?? 0) + 1 },
        });
      }
    });
    stats.set(groups);
    const last = lastTotals.current;
    if (last && last.count === count && last.approvedCents === approvedCents && last.sentCents === sentCents) return;
    lastTotals.current = { count, approvedCents, sentCents };
    onShown?.(lastTotals.current);
  };

  const lastTotals = useRef<GridTotals | null>(null);
  const focusTimer = useRef<number | undefined>(undefined);
  const measureTimer = useRef<number | undefined>(undefined);
  useEffect(
    () => () => {
      window.clearTimeout(focusTimer.current);
      window.clearTimeout(measureTimer.current);
    },
    [],
  );

  // Every function and object handed to AG Grid keeps its identity across renders. A new one is a changed grid option,
  // and AG Grid reacts to some (rowSelection, postSortRows) by rebuilding state mid-gesture: the queue re-renders when
  // the pointer or focus enters the grid, between a click's press and release, and that first click opened nothing.
  // The handlers read the latest props through a ref instead.
  const latest = useRef({ onOpen, onFocusRow, onReady, onDecisionFilter, measure, filterJson, openId, decisionFilter });
  useLayoutEffect(() => {
    latest.current = { onOpen, onFocusRow, onReady, onDecisionFilter, measure, filterJson, openId, decisionFilter };
  });
  const getRowHeight = useMemo(() => (p: RowHeightParams<GridRow>) => (p.node.rowPinned ? 36 : p.data?.group ? 40 : cards ? 88 : 52), [cards]);
  const isFullWidthRow = useMemo(() => (p: IsFullWidthRowParams<GridRow>) => cards || Boolean(p.rowNode.data?.group) || Boolean(p.rowNode.rowPinned), [cards]);
  const getRowClass = useMemo(() => (p: RowClassParams<GridRow>) => (still || !isClaim(p.node) ? undefined : "cursor-pointer"), [still]);
  const postSortRows = useMemo(
    () => (p: PostSortRowsParams<GridRow>) => {
      if (groupRef.current === "none") return;
      const heads = new Map<string, IRowNode<GridRow>>();
      const members = new Map<string, IRowNode<GridRow>[]>();
      for (const n of p.nodes) {
        const r = n.data;
        if (!r) continue;
        if (r.group) heads.set(r.group.key, n);
        else {
          const key = groupOf(r, groupRef.current).key;
          members.set(key, [...(members.get(key) ?? []), n]);
        }
      }
      const keys = [...heads.keys()].filter((k) => members.get(k)?.length).sort((a, b) => (order.current.get(a) ?? 0) - (order.current.get(b) ?? 0));
      p.nodes.splice(0, p.nodes.length, ...keys.flatMap((k) => [heads.get(k)!, ...(folded.current.has(k) ? [] : members.get(k)!)]));
    },
    [],
  );
  const toggleGroup = (grid: GridApi<GridRow>, key: string, open?: boolean) => {
    const isOpen = !folded.current.has(key);
    if (open === isOpen) return;
    if (isOpen) folded.current.add(key);
    else folded.current.delete(key);
    grid.refreshClientSideRowModel("sort");
  };
  const handlers = useMemo(
    () => ({
      onGridReady(e: GridReadyEvent<GridRow>) {
        api.current = e.api;
        const { openId: id, decisionFilter: model } = latest.current;
        if (id) e.api.getRowNode(id)?.setSelected(true, true);
        if (model) e.api.setColumnFilterModel("decision", model).then(() => e.api.onFilterChanged());
      },
      onFirstDataRendered(e: FirstDataRenderedEvent<GridRow>) {
        setReady(true);
        latest.current.onReady?.();
        // A deep link (/console?claim=RM-1460) opens with its row in view: after this render pass, since
        // scrolling redraws the rows.
        // Its index is read then, not now: the tab's filter (set in onGridReady) may still be reordering the rows.
        const id = latest.current.openId;
        if (!id || still) return;
        window.setTimeout(() => {
          const n = e.api.isDestroyed() ? null : e.api.getRowNode(id)?.rowIndex;
          if (n != null) e.api.ensureIndexVisible(n, "middle");
        }, 0);
      },
      // Measured after the grid's own render pass: setting React state inside it would flush mid-render.
      onModelUpdated(e: ModelUpdatedEvent<GridRow>) {
        window.clearTimeout(measureTimer.current);
        measureTimer.current = window.setTimeout(() => !e.api.isDestroyed() && latest.current.measure(e.api), 0);
      },
      onFilterChanged(e: FilterChangedEvent<GridRow>) {
        if (still || !e.columns?.some((c) => c.getColId() === "decision")) return;
        const model = (e.api.getColumnFilterModel("decision") as DecisionModel | null) ?? null;
        if (JSON.stringify(model) !== latest.current.filterJson) latest.current.onDecisionFilter?.(model);
      },
      onRowClicked(e: RowClickedEvent<GridRow>) {
        if (still) return;
        if (e.data?.group) toggleGroup(e.api, e.data.group.key);
        else if (isClaim(e.node)) latest.current.onOpen(e.data!.id);
      },
      onCellKeyDown(e: CellKeyDownEvent<GridRow>) {
        const key = (e.event as KeyboardEvent | null)?.key;
        // A group's heading folds and unfolds like a tree row: Enter or Space toggles, → opens, ← folds.
        if (!still && e.data?.group && (key === "Enter" || key === " " || key === "ArrowRight" || key === "ArrowLeft")) {
          e.event?.preventDefault();
          toggleGroup(e.api, e.data.group.key, key === "ArrowRight" ? true : key === "ArrowLeft" ? false : undefined);
          return;
        }
        // Keys typed faster than the grid redraws can reach the cell focus has just left: the grid's own focused cell,
        // read now, is where the keyboard is, not the cell the event came from.
        const focused = e.api.getFocusedCell();
        const here = focused && !focused.rowPinned ? focused.rowIndex : e.rowIndex;
        if (!still && (key === "Enter" || key === " ") && here != null) {
          const node = e.api.getDisplayedRowAtIndex(here);
          if (isClaim(node)) {
            e.event?.preventDefault();
            latest.current.onOpen(node!.data!.id);
          }
        }
        // j and k walk the claims like ↓ and ↑, skipping group headings (the ? sheet lists them).
        if (!still && (key === "j" || key === "k") && here != null) {
          e.event?.preventDefault();
          const step = key === "j" ? 1 : -1;
          for (let i = here + step; i >= 0 && i < e.api.getDisplayedRowCount(); i += step) {
            if (!isClaim(e.api.getDisplayedRowAtIndex(i))) continue;
            e.api.ensureIndexVisible(i);
            e.api.setFocusedCell(i, "createdAt");
            break;
          }
        }
      },
      onCellFocused(e: CellFocusedEvent<GridRow>) {
        if (e.rowIndex == null || e.rowPinned) return;
        const node = e.api.getDisplayedRowAtIndex(e.rowIndex);
        if (!isClaim(node)) return;
        keepInView(wrap.current, node!.data!.id);
        const onFocus = latest.current.onFocusRow;
        if (!onFocus) return;
        const id = node!.data!.id;
        // Holding ↓ walks many rows: the panel follows only where the focus settles (120ms).
        window.clearTimeout(focusTimer.current);
        focusTimer.current = window.setTimeout(() => onFocus(id), 120);
      },
      focusGridInnerElement(p: FocusGridInnerElementParams<GridRow>) {
        if (still || !p.api.getDisplayedRowCount()) return false;
        let row = (openRef.current ? p.api.getRowNode(openRef.current)?.rowIndex : null) ?? -1;
        if (row < 0) for (row = 0; row < p.api.getDisplayedRowCount() && !isClaim(p.api.getDisplayedRowAtIndex(row)); row++);
        p.api.ensureIndexVisible(row);
        p.api.setFocusedCell(row, "createdAt");
        return true;
      },
    }),
    [still],
  );

  return (
    // While loading, a filled grid clips its skeleton: 12 skeleton rows outgrow a short panel and covered the footer below.
    <div
      ref={wrap}
      className={className ?? (fill ? `claims-grid relative h-full w-full${ready ? "" : " overflow-hidden"}` : "claims-grid relative w-full")}
      aria-busy={!ready || undefined}
    >
      {!ready && <SkeletonGrid rows={Math.min(rows.length, 12)} cards={cards} />}
      {width !== null && (
        <div className={ready ? (fill && !cards ? "h-full" : undefined) : "invisible absolute inset-x-0 top-0"}>
          {/* Remounted when the layout switches between cards and columns: AG Grid keeps a rendered row's full-width state. */}
          <AgGridReact<GridRow>
            key={cards ? "cards" : "columns"}
            theme={gridTheme}
            rowData={rowData}
            columnDefs={columns}
            getRowId={rowId}
            context={context}
            domLayout={fill && !cards ? "normal" : "autoHeight"}
            getRowHeight={getRowHeight}
            headerHeight={cards ? 0 : 36}
            isFullWidthRow={isFullWidthRow}
            fullWidthCellRenderer={FullWidthRow}
            quickFilterText={still ? undefined : search}
            cacheQuickFilter
            // A group's heading stays while any of its claims pass; postSortRows drops a heading left with none.
            alwaysPassFilter={isGroupNode}
            postSortRows={postSortRows}
            // Filters run as handlers: a tab's filter applies on its first click, before any filter menu has opened.
            enableFilterHandlers
            rowSelection={ROW_SELECTION}
            localeText={LOCALE}
            tooltipShowDelay={250}
            tooltipHideDelay={2000}
            onGridReady={handlers.onGridReady}
            onFirstDataRendered={handlers.onFirstDataRendered}
            onModelUpdated={handlers.onModelUpdated}
            onFilterChanged={handlers.onFilterChanged}
            onRowClicked={handlers.onRowClicked}
            onCellKeyDown={handlers.onCellKeyDown}
            onCellFocused={handlers.onCellFocused}
            getRowClass={getRowClass}
            // Nor does a row light up under the pointer: the still's rows open nothing.
            suppressRowHoverHighlight={still}
            // The homepage's still is a picture: no cell or header takes focus. In both, Tab leaves the grid in one step
            // (to the evidence panel and the footer); the arrow keys move between cells.
            // Card rows have no header (0px tall): it must never be a tab stop. A full-width row is focused through its
            // first column, the claim's, which every layout keeps.
            suppressCellFocus={still}
            suppressHeaderFocus={still || cards}
            tabToNextCell={noTab}
            focusGridInnerElement={handlers.focusGridInnerElement}
            overlayNoRowsTemplate="<span></span>"
            // The DOM follows the rows' order on screen, so a screen reader meets each group's heading before its claims.
            ensureDomOrder
            animateRows={animate}
            cellFlashDuration={600}
            cellFadeDuration={900}
            suppressDragLeaveHidesColumns
          />
        </div>
      )}
    </div>
  );
});

const CSV_HEADERS: Record<string, string> = {
  createdAt: "Claim",
  filedAt: "Filed (UTC)",
  code: "Code",
  decision: "Verdict",
  reason: "Reason",
  checks: "Checks",
  time: "Photo check answered in (s)",
  toPay: "Photos to payout (s)",
  payer: "PayPal account",
  payoutStatus: "Payout",
  amount: "Amount (USD)",
};

/** A cell as the CSV writes it: plain words and numbers, never the grid's markup. */
function csvCell(colId: string, r: GridRow | undefined): string {
  if (!r) return "";
  switch (colId) {
    case "createdAt":
      return r.id;
    case "filedAt":
      return r.createdAt;
    case "code":
      return r.code ?? "";
    case "decision":
      return verdictLabel(r) ?? { held: "Held", rejected: "Rejected", blocked: "Blocked", pending: "In progress", paid: "Approved" }[r.decision];
    case "reason":
      return reasonKey(r);
    case "checks":
      return r.bars ? `${r.bars.filter((b) => b.state === "pass").length} of ${r.bars.length} passed` : "";
    case "time":
      return r.modelSec === null ? "" : String(r.modelSec);
    case "toPay":
      return r.toPay === null ? "" : String(r.toPay);
    case "payer":
      return r.payer.replace(/•/g, "*");
    case "payoutStatus":
      return r.payoutFailedAt ? "Not sent (PayPal refused)" : sent(r) ? (r.payoutStatus ?? "") : r.decision === "paid" ? "Approved (no payout)" : "";
    case "amount":
      return r.cents === null ? "" : (r.cents / 100).toFixed(2);
  }
  return "";
}

