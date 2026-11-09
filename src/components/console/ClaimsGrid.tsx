"use client";

import {
  CellStyleModule,
  ClientSideRowModelApiModule,
  ClientSideRowModelModule,
  ColumnApiModule,
  CsvExportModule,
  CustomFilterModule,
  ExternalFilterModule,
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
  type Module,
  type RowClickedEvent,
  type RowHeightParams,
} from "ag-grid-community";
import { AgGridReact, type CustomCellRendererProps } from "ag-grid-react";
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { barsSentence, searchKey, searchText, type ClaimRow } from "@/app/console/_lib/view";
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
  ToPayCell,
  HeaderOnlyTip,
  payoutWord,
  TimeCell,
  TimelineTooltip,
  VerdictCell,
  type GridContext,
  type GridRow,
  type GroupStats,
  type GroupTotal,
} from "./cells";
import { SkeletonGrid } from "./ConsoleSkeleton";
import { ClaimFilter, claimFilterPass, DecisionFilter, decisionFilterPass, reasonGroup, reasonKey, type DecisionModel } from "./DecisionFilter";
import { formatDate } from "./format";
import { gridTheme, stillTheme } from "./gridTheme";
import { verdictOf, verdictWord } from "./VerdictMark";
import { moneyCents, type MoneyState } from "@/lib/payoutWords";
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

// The homepage's still filters its rows in place (the tour's Held step) and takes a claim's arrival as a transaction, so
// AG Grid's row animation shows the queue narrowing and the row coming in. Its external filter is registered on that
// grid only, through its own `modules`: the console's queue filters through its columns and the quick filter. The
// transactions and the sort reset use the row model and column APIs registered above.
const STILL_MODULES: Module[] = [ExternalFilterModule];

// Below this width of grid the queue shows one card per claim (phones). Down to it the grid keeps real columns, the
// claim, its verdict and reason, and the amount, so 200% zoom on a laptop (672px) is still a grid.
export const CARD_BELOW = 576;
// Columns that come and go with the grid's width (the evidence panel takes 452px). The queue always keeps the claim
// (220), the amount (96) and the verdict, at least 260; the homepage's still also always keeps the checks (136), with a
// verdict of 144, and keeps its columns down to 592px. Each optional column is added, in order, while it fits; in the
// queue only while the verdict keeps 320px, room for a reason like "Couldn't tell if both photos show the same item"
// beside its mark: the reason is what a reviewer reads first. The verdict takes every pixel the other columns leave, so
// the amount always closes the row on the grid's right edge (where a group's total sits) and a reason runs whole rather
// than truncating beside an empty band. The checks strip comes first, then the payout (the money's question), then the
// answer time.
const VERDICT_MIN = { queue: 260, still: 144 };
const VERDICT_WANT = { queue: 320, still: 144 };
const BASE = { queue: 220 + 96, still: 220 + 136 + 96 };
// The queue has no PayPal account column at a laptop's width: search finds an account, and the evidence panel names
// it. The homepage's still draws the queue as a laptop's console shows it, so it never has one.
// On a wide queue (a 1920 screen, nothing open) the verdict would otherwise take 1,100px a reason never uses: the
// PayPal account and the photo-to-payout time come in from 1600px of grid, each only while the verdict keeps
// VERDICT_ROOMY, so a verdict and its money stay in one glance.
const PAYER = 172;
const OPTIONAL = {
  // The queue's one time column says both times: the answer, and the payout under it where it came later (TimeCell).
  queue: { checks: 112, payoutStatus: 120, time: 124, payer: PAYER } as Record<string, number>,
  // "Answered in" whole on its 12px padding, right-aligned over its values: 104px.
  still: { time: 104, payoutStatus: 112 } as Record<string, number>,
};
const ORDER = { queue: ["checks", "payoutStatus", "time", "payer"], still: ["payoutStatus", "time"] };
// Columns only a wide queue shows, and the verdict width they leave.
const ROOMY_ONLY = new Set(["payer"]);
const ROOMY_FROM = 1600;
const VERDICT_ROOMY = 460;

function hiddenAt(width: number, still: boolean): Set<string> {
  const mode = still ? "still" : "queue";
  let room = width - BASE[mode] - VERDICT_WANT[mode];
  const hidden = new Set<string>();
  for (const id of ORDER[mode]) {
    const roomy = !still && ROOMY_ONLY.has(id);
    const fits = roomy ? width >= ROOMY_FROM && room - OPTIONAL[mode][id] >= VERDICT_ROOMY - VERDICT_WANT[mode] : room >= OPTIONAL[mode][id];
    // In the queue the columns come in order: once one is left out, so is every one after it.
    if (fits && (still || !hidden.size)) room -= OPTIONAL[mode][id];
    else hidden.add(id);
  }
  if (still) hidden.add("payer");
  // Photo to payout is the time column's second line (TimeCell), never a column of its own.
  return hidden.add("toPay");
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
  // The approved claims' money by where it is (lib/payoutWords.ts): paid, sent and settling, approved with nothing sent.
  cents: Record<MoneyState, number>;
}

export interface ClaimsGridHandle {
  /** Puts keyboard focus back on a claim's row (after the panel closes). */
  focusRow(id: string): void;
  /** Puts keyboard focus on the first claim row (↓ or j from outside the grid). */
  focusFirst(): void;
  /** Puts keyboard focus on the claim after (1) or before (-1) this one, in the grid's order. */
  step(id: string, dir: 1 | -1): void;
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
  /** The homepage's still: a claim arrives at `index` as `interim`, then becomes `final` after `after` ms (its changed
   * cells flash). Returns settle(), which applies the final row at once. `instant`: no row animation (the grid is out
   * of sight, or the claim is simply put back). */
  arrive(interim: ClaimRow, final: ClaimRow, index: number, after?: number, instant?: boolean): () => void;
  /** The homepage's still: takes a row out (to replay its arrival). */
  remove(id: string): void;
  /** The homepage's still: redraws a row in place (its changed cells flash). */
  update(row: ClaimRow): void;
  /** The homepage's still: shows only the rows that pass (null for all), animating the change. */
  setFilter(pass: ((row: ClaimRow) => boolean) | null): void;
  /** The homepage's still: selects a claim's row (the open row's tint and edge) and scrolls it into view (`middle`: to
   * the middle of the list, never left half cut at its foot); null clears. */
  open(id: string | null, middle?: boolean): void;
  /** The homepage's still: back to the order its rows came in (a visitor's sort undone), scrolled to the first row. */
  resetSort(): void;
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
  // A line under a list short enough to end on screen ("That's every claim waiting for a person.").
  footnote?: string;
  /** V or Space on the open claim's row: its photos. */
  onViewPhotos?: () => void;
  /** Read only (the homepage preview): no keyboard opening, no tooltips, no filters. */
  still?: boolean;
  /** Sort oldest first (the held tab: the longest waiting leads) instead of newest first. */
  oldestFirst?: boolean;
  /** Keep the rows in the order they come in (the sign-in page's picture: decided claims first), unsorted. */
  keepOrder?: boolean;
  /** Search words, matched by the grid's quick filter against the claim id, code, PayPal account and reason. */
  search?: string;
  /** The Verdict column's filter (the status tabs set it); onDecisionFilter hears it change from the column's menu. */
  decisionFilter?: DecisionModel | null;
  onDecisionFilter?: (model: DecisionModel | null) => void;
  groupBy?: GroupBy;
  /** What the grid shows after its filters: the claims, the money they approved and the money sent. */
  onShown?: (totals: GridTotals) => void;
  /** The claims picked for a bulk decision (Shift+↑/↓, Shift-click, Cmd- or Ctrl-click, X). */
  picked?: ReadonlySet<string>;
  /** The pick changed: the whole new pick, in the grid's order. */
  onPick?: (ids: string[]) => void;
  /** The first rows are drawn (the skeleton has gone). */
  onReady?: () => void;
  /** The homepage's still: a click on a row (the tour opens a held claim's evidence, or selects the row). */
  onStillClick?: (row: ClaimRow) => void;
  /** The homepage's still: which rows a click opens (they take the pointer cursor). */
  stillOpens?: (row: ClaimRow) => boolean;
  /** The homepage's still: the checks column names each check on hover, as the console's does. */
  stillTips?: boolean;
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
/** The claims from one row to another, inclusive, in the grid's order (group headings left out). */
function between(grid: GridApi<GridRow>, a: string, b: string) {
  const ids: string[] = [];
  grid.forEachNodeAfterFilterAndSort((n) => isClaim(n) && n.displayed && ids.push(n.data!.id));
  const i = ids.indexOf(a);
  const j = ids.indexOf(b);
  if (i < 0 || j < 0) return [b];
  return ids.slice(Math.min(i, j), Math.max(i, j) + 1);
}
/** A set of claims in the grid's order. */
function ordered(grid: GridApi<GridRow>, set: Iterable<string>) {
  const want = new Set(set);
  const ids: string[] = [];
  grid.forEachNodeAfterFilterAndSort((n) => isClaim(n) && want.has(n.data!.id) && ids.push(n.data!.id));
  return ids;
}
function firstClaimIndex(grid: GridApi<GridRow>): number {
  for (let i = 0; i < grid.getDisplayedRowCount(); i++) if (isClaim(grid.getDisplayedRowAtIndex(i))) return i;
  return -1;
}
const rowId = (p: GetRowIdParams<GridRow>) => p.data.id;
// Search's words against a row's text, as the queue's tab counts match them: O and 0 are one character (searchKey).
const quickMatch = (parts: string[], text: string) => {
  const t = searchKey(text);
  return parts.every((p) => t.includes(searchKey(p)));
};
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
  {
    rows,
    label,
    openId,
    onOpen,
    onOpenLinked,
    onFocusRow,
    onViewPhotos,
    fill = false,
    footnote,
    still = false,
    oldestFirst = false,
    keepOrder = false,
    search = "",
    decisionFilter,
    onDecisionFilter,
    groupBy = "none",
    onShown,
    picked,
    onPick,
    onReady,
    onStillClick,
    stillOpens,
    stillTips = false,
    className,
  },
  ref,
) {
  const wrap = useRef<HTMLDivElement>(null);
  const api = useRef<GridApi<GridRow> | null>(null);
  // When the pointer last moved over the grid, and when the grid last reflowed: a hover card opens only for a pointer
  // that moved since, never for a cell that slid under a still one.
  const moved = useRef(0);
  const shifted = useRef(0);
  const pointerSettled = useMemo(() => () => moved.current > shifted.current, []);
  // Unknown until measured, so the grid mounts in its final layout (cards or columns) and never jumps.
  const [width, setWidth] = useState<number | null>(null);
  // AG Grid paints nothing until its script runs; the skeleton holds the grid's footprint until the first rows.
  const [ready, setReady] = useState(false);
  const [animate] = useState(() => !reducedMotion());
  const [stats] = useState(groupStore);
  // The filter button that opened the popup that's up: Esc returns focus to it, the small target it came from, never
  // the whole header cell.
  const filterHeader = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const note = (e: Event) => {
      const button = (e.target as Element | null)?.closest?.<HTMLElement>(".ag-header-cell .ag-header-cell-filter-button, .ag-header-cell .ag-header-cell-menu-button");
      const header = (e.target as Element | null)?.closest?.<HTMLElement>(".ag-header-cell");
      if (button) filterHeader.current = button;
      // A filter opened from the keyboard on its header: the header's own button.
      else if (header && e.type === "keydown") filterHeader.current = header.querySelector<HTMLElement>(".ag-header-cell-filter-button, .ag-header-cell-menu-button") ?? header;
    };
    el.addEventListener("pointerdown", note, true);
    el.addEventListener("keydown", note, true);
    return () => {
      el.removeEventListener("pointerdown", note, true);
      el.removeEventListener("keydown", note, true);
    };
  }, []);
  const filter = useRef<((row: ClaimRow) => boolean) | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => {
      // The grid reflowed under a pointer that didn't move (the evidence panel opened): no hover card until it moves.
      shifted.current = performance.now();
      setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    const onMove = () => (moved.current = performance.now());
    el.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("pointermove", onMove);
    };
  }, []);

  const cards = width !== null && width < (still ? BASE.still + VERDICT_MIN.still : CARD_BELOW);
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

  const linked = useRef(onOpenLinked);
  useLayoutEffect(() => {
    linked.current = onOpenLinked;
  });
  const context = useMemo<GridContext>(
    () => ({ stacked: still, groups: stats, open: still ? undefined : (id: string) => linked.current?.(id) }),
    [still, stats],
  );

  useImperativeHandle(ref, () => ({
    focusRow(id) {
      const grid = api.current;
      const node = grid?.getRowNode(id);
      if (!grid || node?.rowIndex == null) return;
      grid.ensureIndexVisible(node.rowIndex);
      grid.setFocusedCell(node.rowIndex, "createdAt");
      cursor.current = id;
      anchor.current = null;
    },
    focusFirst() {
      const grid = api.current;
      if (!grid) return;
      for (let i = 0; i < grid.getDisplayedRowCount(); i++) {
        const node = grid.getDisplayedRowAtIndex(i);
        if (!isClaim(node)) continue;
        grid.ensureIndexVisible(i);
        grid.setFocusedCell(i, "createdAt");
        cursor.current = node!.data!.id;
        anchor.current = null;
        return;
      }
    },
    step(id, dir) {
      const grid = api.current;
      const node = grid?.getRowNode(id);
      if (!grid || node?.rowIndex == null) return;
      let i = node.rowIndex + dir;
      while (i >= 0 && i < grid.getDisplayedRowCount() && !isClaim(grid.getDisplayedRowAtIndex(i))) i += dir;
      const to = grid.getDisplayedRowAtIndex(i);
      if (!isClaim(to)) return;
      grid.ensureIndexVisible(i);
      grid.setFocusedCell(i, "createdAt");
      cursor.current = to!.data!.id;
      anchor.current = null;
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
      const back = filterHeader.current;
      if (back && !back.matches("[tabindex], button")) back.tabIndex = -1;
      back?.focus();
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
    arrive(interim, final, index, after = 900, instant = false) {
      const grid = api.current;
      if (!grid) return () => {};
      if (instant && animate) {
        grid.setGridOption("animateRows", false);
        requestAnimationFrame(() => api.current?.setGridOption("animateRows", true));
      }
      if (!grid.getRowNode(final.id)) grid.applyTransaction({ add: [interim], addIndex: index });
      let done = false;
      const settle = () => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        if (api.current?.getRowNode(final.id)) api.current.applyTransaction({ update: [final] });
        else api.current?.applyTransaction({ add: [final], addIndex: index });
      };
      const timer = window.setTimeout(settle, after);
      timers.current.push(timer);
      return settle;
    },
    remove(id) {
      const node = api.current?.getRowNode(id);
      if (node?.data) api.current?.applyTransaction({ remove: [node.data] });
    },
    update(row) {
      if (api.current?.getRowNode(row.id)) api.current.applyTransaction({ update: [row] });
    },
    setFilter(pass) {
      filter.current = pass;
      api.current?.onFilterChanged();
    },
    open(id, middle) {
      const grid = api.current;
      if (!grid) return;
      if (!id) return grid.deselectAll();
      const node = grid.getRowNode(id);
      node?.setSelected(true, true);
      if (node?.rowIndex != null) grid.ensureIndexVisible(node.rowIndex, middle ? "middle" : null);
    },
    resetSort() {
      // Back to the queue's own order: newest first (the sign-in picture's: its rows as they came).
      api.current?.applyColumnState({ state: keepOrder ? [] : [{ colId: "createdAt", sort: "desc" }], defaultState: { sort: null } });
      if (api.current?.getDisplayedRowCount()) api.current.ensureIndexVisible(0, "top");
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
      const kept = open?.displayed && open.rowIndex != null;
      const at = kept ? open.rowIndex! : firstClaimIndex(grid);
      if (at < 0) return grid.clearFocusedCell();
      // The new list's first claim, with the list at its top (no row under the header), and the next j stays on it, as j
      // does from outside the list: "3 j" lands on the oldest held claim whether or not a row had focus before.
      grid.ensureIndexVisible(at, kept ? null : "top");
      grid.setFocusedCell(at, "createdAt");
      fresh.current = kept ? null : (grid.getDisplayedRowAtIndex(at)?.data?.id ?? null);
    }, 0);
    return () => window.clearTimeout(t);
  }, [listKey, still]);

  // A new list (a tab, a search, a grouping): a hover card still fading over the old rows goes at once (claims-grid.css).
  const viewKey = `${filterJson}|${search}|${grouping}`;
  const lastView = useRef(viewKey);
  useEffect(() => {
    const el = wrap.current;
    if (!el || lastView.current === viewKey) return;
    lastView.current = viewKey;
    el.dataset.tipsOff = "";
    const t = window.setTimeout(() => delete el.dataset.tipsOff, 400);
    return () => window.clearTimeout(t);
  }, [viewKey]);

  // A new grouping starts at the top of the list, or with the keyboard's claim in the middle of it, never at the old
  // pixel offset (partway into a group, its head out of sight); and on a row's edge, never with a row cut under the
  // header.
  const lastGrouping = useRef(grouping);
  useEffect(() => {
    const grid = api.current;
    if (!grid || still || lastGrouping.current === grouping) return;
    lastGrouping.current = grouping;
    const t = window.setTimeout(() => {
      if (grid.isDestroyed() || !grid.getDisplayedRowCount()) return;
      const at = cursor.current ? grid.getRowNode(cursor.current) : null;
      if (!at?.displayed || at.rowIndex == null) return grid.ensureIndexVisible(0, "top");
      grid.ensureNodeVisible(at, "middle");
      const top = grid.getVerticalPixelRange().top;
      for (let i = 0; i < grid.getDisplayedRowCount(); i++) {
        const node = grid.getDisplayedRowAtIndex(i);
        if (node && node.rowTop != null && node.rowHeight != null && node.rowTop + node.rowHeight > top) {
          if (node.rowTop < top) grid.ensureIndexVisible(i, "top");
          break;
        }
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [grouping, rowData, still]);

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
        // The second line's time is UTC (cells.tsx), said once for the page in its heading ("Times in UTC").
        headerName: "Claim",
        headerTooltip: still ? undefined : "The claim, the code on its tag, and when it was filed (UTC).",
        field: "createdAt",
        cellRenderer: ClaimCell,
        width: 220,
        pinned: "left",
        lockPinned: true,
        suppressMovable: true,
        sortable: true,
        // The queue is newest first, the held tab oldest first, and the homepage's still newest first as the queue is,
        // its arrow shown; a sign-in picture that keeps its rows' order (keepOrder) is not sorted. A header click flips
        // the order, with no unsorted step between.
        sort: keepOrder ? undefined : oldestFirst ? "asc" : "desc",
        sortingOrder: ["desc", "asc"],
        // Claims filed in the same minute: the claim id breaks the tie, so a run of identical photos and codes doesn't
        // sit together.
        comparator: (a: string, b: string, na, nb) => a.localeCompare(b) || (na.data?.id ?? "").localeCompare(nb.data?.id ?? ""),
        // Search already finds ids and codes; the column's own filter picks codes and days, with their counts.
        filter: still ? undefined : { component: ClaimFilter, doesFilterPass: claimFilterPass },
        getQuickFilterText: (p) => (p.data ? searchText(p.data) : ""),
        tooltip: (p) => (!still && p.data?.photos.length && pointerSettled() ? p.data.id : undefined),
        tooltipComponent: PhotoTooltip,
      },
      {
        colId: "decision",
        headerName: "Verdict",
        // The pill and its line: AG Grid redraws (and flashes) a cell only when its value changes, and a held claim's
        // line changes on its own (a refused payout).
        valueGetter: (p) => (p.data ? `${p.data.decision} ${p.data.note ?? ""}` : null),
        cellRenderer: VerdictCell,
        // The spare width: the reason is what a reviewer reads first, and the amount stays on the right edge. In the queue
        // it shares the width with the columns after it (four parts to their one each) up to 600px, room for the longest
        // reason, so a 1920 screen has no empty band between a verdict and its checks.
        flex: still ? 1 : 4,
        minWidth: still ? VERDICT_MIN.still : VERDICT_MIN.queue,
        maxWidth: still ? undefined : 460,
        // The homepage's still sorts by verdict too (a visitor's quickest check that it's a grid).
        sortable: true,
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
        headerTooltip: still
          ? undefined
          : "Five checks: three account checks, then the photo check’s two. Solid: passed. Half: held. Slashed: failed. Outline: waiting. Dashed: not run. Hover a row for each answer.",
        cellRenderer: ChecksCell,
        width: still ? 136 : OPTIONAL.queue.checks,
        tooltip: (p) => ((!still || stillTips) && p.data?.bars && (still || pointerSettled()) ? p.data.id : undefined),
        tooltipComponent: ChecksTooltip,
        getQuickFilterText: () => "",
      },
      {
        colId: "time",
        headerName: "Answered in",
        headerTooltip: still ? undefined : "How long the photo check took to answer; under it, when the payout came later (a person approved it). Hover a row for every step.",
        cellRenderer: TimeCell,
        width: OPTIONAL[still ? "still" : "queue"].time,
        type: "rightAligned",
        tooltip: (p) => (!still && p.data?.timeline && pointerSettled() ? p.data.id : undefined),
        tooltipComponent: TimelineTooltip,
        sortable: true,
        valueGetter: (p) => p.data?.modelSec ?? null,
        // Claims with no time last, whichever way.
        comparator: (a: number | null, b: number | null, _na, _nb, desc) =>
          a === null ? (b === null ? 0 : desc ? -1 : 1) : b === null ? (desc ? 1 : -1) : a - b,
        getQuickFilterText: () => "",
      },
      {
        colId: "toPay",
        headerName: "Photo to payout",
        headerTooltip: still ? undefined : "Seconds from the photos arriving to PayPal taking the payout. Only claims a payout was sent for.",
        tooltipComponent: still ? undefined : HeaderOnlyTip,
        cellRenderer: ToPayCell,
        width: OPTIONAL.queue.toPay,
        type: "rightAligned",
        sortable: true,
        valueGetter: (p) => p.data?.toPay ?? null,
        comparator: (a: number | null, b: number | null, _na, _nb, desc) =>
          a === null ? (b === null ? 0 : desc ? -1 : 1) : b === null ? (desc ? 1 : -1) : a - b,
        getQuickFilterText: () => "",
      },
      {
        colId: "payer",
        headerName: "PayPal",
        field: "payer",
        cellRenderer: PayerCell,
        width: PAYER,
        // A gap before it, so a right-aligned time beside it never sits against the account.
        cellClass: "!pl-6",
        headerClass: "!pl-6",
        getQuickFilterText: () => "",
      },
      {
        colId: "payoutStatus",
        headerName: "Payout",
        valueGetter: (p) => (p.data ? (p.data.payoutFailedAt ? `not sent ${p.data.payoutFailedAt}` : p.data.payoutStatus) : null),
        cellRenderer: PayoutCell,
        width: OPTIONAL[still ? "still" : "queue"].payoutStatus,
        headerTooltip: still ? undefined : "Sent and settling once PayPal has the payout, Paid once PayPal confirms it, Refused when PayPal didn’t take it.",
        tooltipComponent: still ? undefined : HeaderOnlyTip,
        enableCellChangeFlash: true,
        // The homepage's still draws its claims as live ones: one the rule decided to pay during its arrival flashes paid.
        cellClass: (p) => (p.data?.payoutStatus === "SUCCESS" || (still && p.data?.decision === "paid") ? undefined : "flash-neutral"),
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
        // The homepage's still pays one refund per unit, so every amount is the same: sorting it would look broken.
        sortable: !still,
        // Claims with no amount (refused, in progress) last, whichever way: a sort by money starts with money.
        comparator: (a: number | null, b: number | null, _na, _nb, desc) =>
          a === null ? (b === null ? 0 : desc ? -1 : 1) : b === null ? (desc ? 1 : -1) : a - b,
        type: "rightAligned",
        getQuickFilterText: () => "",
      },
      // For the CSV only: the claim's code, when it was filed and the reason as their own columns.
      { colId: "code", headerName: "Code", valueGetter: (p) => p.data?.code ?? "", hide: true },
      { colId: "filedAt", headerName: "Filed (UTC)", field: "createdAt", hide: true },
      { colId: "reason", headerName: "Reason", valueGetter: (p) => (p.data ? reasonKey(p.data) : ""), hide: true },
    ];
    return all.map((c) => ({
      sortable: false,
      resizable: !still && !c.pinned,
      suppressMovable: still,
      suppressHeaderMenuButton: true,
      ...c,
      // In the queue the account and the payout take what a wide grid has past the verdict's 460px, so the money and
      // whose it is spread out, while the strip and the time keep their width beside the reason.
      ...(!still && (c.colId === "payer" || c.colId === "payoutStatus") && c.width ? { flex: 1, minWidth: c.width } : {}),
      hide: c.hide || hidden.has(c.colId ?? ""),
    }));
  }, [hidden, still, oldestFirst, keepOrder, stillTips, pointerSettled]);

  // After every filter, sort or data change: the totals under the grid, each group's count and sum, and the count the
  // queue's footer gives.
  const measure = (grid: GridApi<GridRow>) => {
    // A list shorter than the room sizes the grid to its rows, so a short tab (Held) never reads as a grid that failed
    // to load; the footnote under it says the list is whole.
    if (fill && !cards && !still && wrap.current) {
      let h = 37;
      for (let i = 0; i < grid.getDisplayedRowCount(); i++) h += grid.getDisplayedRowAtIndex(i)?.rowHeight ?? 52;
      setShort(grid.getDisplayedRowCount() > 0 && h + 48 <= wrap.current.clientHeight ? h : null);
    }
    let count = 0;
    const shown: GridRow[] = [];
    const groups = new Map<string, GroupTotal>();
    grid.forEachNodeAfterFilter((n) => {
      const r = n.data;
      if (!r || r.group) return;
      count++;
      shown.push(r);
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
    const cents = moneyCents(shown);
    const last = lastTotals.current;
    if (last && last.count === count && (Object.keys(cents) as MoneyState[]).every((k) => last.cents[k] === cents[k])) return;
    lastTotals.current = { count, cents };
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
  const latest = useRef({ onOpen, onFocusRow, onReady, onDecisionFilter, measure, filterJson, openId, decisionFilter, onStillClick, onPick, picked, onViewPhotos });
  useLayoutEffect(() => {
    latest.current = { onOpen, onFocusRow, onReady, onDecisionFilter, measure, filterJson, openId, decisionFilter, onStillClick, onPick, picked, onViewPhotos };
  });
  // Picking: the row a range starts from (the last row focused or clicked without Shift) and the pick as it stood then (a
  // range adds to it). `now` is the pick as last handed up, so fast keys never read a pick React hasn't drawn yet.
  const anchor = useRef<{ id: string; base: string[] } | null>(null);
  // The claim the keyboard is on, by id: a row index moves when a decided claim leaves the list or a poll adds rows, so
  // after each change the grid's focus is put back on this claim (onModelUpdated).
  const cursor = useRef<string | null>(null);
  // The rows' height when the list ends on screen (the grid sizes to them), else null.
  const [short, setShort] = useState<number | null>(null);
  // The claim a tab switch focused, until the next key (see the list effect).
  const fresh = useRef<string | null>(null);
  const now = useRef<string[]>([]);
  useLayoutEffect(() => {
    now.current = [...(picked ?? [])];
  }, [picked]);
  // The claims Shift+↑/↓ moved focus to, and when: the grid reports each focus a moment later (after a run of fast keys,
  // all at once), and onCellFocused leaves the anchor and the open panel where they are for those.
  const ownMoves = useRef(new Map<string, number>());
  const pick = useMemo(() => {
    const hand = (ids: string[]) => {
      now.current = ids;
      latest.current.onPick?.(ids);
    };
    return {
      range(grid: GridApi<GridRow>, to: string) {
        const from = anchor.current ?? { id: to, base: [] };
        anchor.current = from;
        hand(ordered(grid, [...from.base, ...between(grid, from.id, to)]));
      },
      toggle(grid: GridApi<GridRow>, id: string) {
        const set = new Set(now.current);
        if (set.has(id)) set.delete(id);
        else set.add(id);
        const next = ordered(grid, set);
        anchor.current = { id, base: next };
        hand(next);
      },
      from(id: string) {
        anchor.current = { id, base: [...now.current] };
      },
    };
  }, []);
  // The keyboard in the list, handled as each key arrives, in order. AG Grid hands its cellKeyDown and cellFocused events
  // to the grid's callbacks a moment later (after a run of fast keys, all at once), so a key acted on there could land
  // after the next one: j×7 then Shift+↓ picked the top rows. Here every key reads and moves the grid's focused cell at
  // once: j and k walk the claims (over group headings), Enter opens, Space opens (or, on the open claim, shows its
  // photos), X picks, and Shift+↑/↓ picks from the anchor to the new row. A plain move lets the anchor go, so the next
  // Shift press starts from the row the keyboard is on: N presses pick N+1 claims.
  useEffect(() => {
    const el = wrap.current;
    if (!el || still) return;
    const onKey = (e: KeyboardEvent) => {
      const grid = api.current;
      const target = e.target as Element | null;
      if (!grid || !target?.closest(".ag-row") || target.closest(".ag-popup") || e.metaKey || e.ctrlKey || e.altKey) return;
      const at = grid.getFocusedCell();
      if (!at || at.rowPinned) return;
      const here = grid.getDisplayedRowAtIndex(at.rowIndex);
      // A new list's first claim, focused by the tab switch: the first j enters it there rather than passing it.
      const entered = fresh.current;
      fresh.current = null;
      if (e.key === "j" && !e.shiftKey && entered && here?.data?.id === entered) {
        e.preventDefault();
        e.stopPropagation();
        grid.ensureIndexVisible(at.rowIndex, "top");
        return;
      }
      const walk = (step: 1 | -1) => {
        let i = at.rowIndex + step;
        while (i >= 0 && i < grid.getDisplayedRowCount() && !isClaim(grid.getDisplayedRowAtIndex(i))) i += step;
        return i >= 0 && i < grid.getDisplayedRowCount() ? i : -1;
      };
      const stop = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      if (e.shiftKey && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        if (!latest.current.onPick) return;
        stop();
        if (!anchor.current && isClaim(here)) pick.from(here!.data!.id);
        const i = walk(e.key === "ArrowDown" ? 1 : -1);
        const node = i < 0 ? null : grid.getDisplayedRowAtIndex(i);
        if (!isClaim(node)) {
          // The list's end: the claim already focused is picked, so the key is never silent.
          if (isClaim(here)) pick.range(grid, here!.data!.id);
          return;
        }
        ownMoves.current.set(node!.data!.id, performance.now());
        grid.ensureIndexVisible(i);
        grid.setFocusedCell(i, "createdAt");
        cursor.current = node!.data!.id;
        pick.range(grid, node!.data!.id);
        return;
      }
      if (e.shiftKey) return;
      const key = e.key;
      if (key === "j" || key === "k") {
        stop();
        const i = walk(key === "j" ? 1 : -1);
        if (i < 0) return;
        grid.ensureIndexVisible(i);
        grid.setFocusedCell(i, "createdAt");
        cursor.current = grid.getDisplayedRowAtIndex(i)?.data?.id ?? null;
        anchor.current = null;
        return;
      }
      if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End"].includes(key)) {
        // AG Grid moves the focus itself, right after this: the next Shift press anchors where it lands.
        anchor.current = null;
        return;
      }
      if (!isClaim(here)) return;
      const id = here!.data!.id;
      if (key === "Enter" || key === " ") {
        stop();
        if (key === " " && id === latest.current.openId) latest.current.onViewPhotos?.();
        else latest.current.onOpen(id);
      } else if ((key === "x" || key === "X") && latest.current.onPick) {
        stop();
        pick.toggle(grid, id);
      }
    };
    el.addEventListener("keydown", onKey, true);
    return () => el.removeEventListener("keydown", onKey, true);
  }, [still, pick]);

  const getRowHeight = useMemo(() => (p: RowHeightParams<GridRow>) => (p.node.rowPinned ? 36 : p.data?.group ? 40 : cards ? 104 : 52), [cards]);
  const isFullWidthRow = useMemo(() => (p: IsFullWidthRowParams<GridRow>) => cards || Boolean(p.rowNode.data?.group) || Boolean(p.rowNode.rowPinned), [cards]);
  // The still's rows take the pointer only where a click opens something (the homepage tour's held claims).
  const getRowClass = useMemo(
    () => (p: RowClassParams<GridRow>) => (!isClaim(p.node) ? undefined : !still || (p.data && stillOpens?.(p.data)) ? "cursor-pointer" : undefined),
    [still, stillOpens],
  );
  // The still's own filter (the tour's Held step), read through a ref so the grid's options keep their identity.
  const isExternalFilterPresent = useMemo(() => () => filter.current !== null, []);
  const doesExternalFilterPass = useMemo(() => (node: IRowNode<GridRow>) => (node.data ? (filter.current?.(node.data) ?? true) : true), []);
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
  const handlers = useMemo(() => {
    return {
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
        // A row came or went above the keyboard's claim: focus stays on that claim, not on the index it had. Only while
        // the keyboard is in the list (or dropped to the page with it), so a model change never pulls focus from elsewhere.
        const id = cursor.current;
        const focused = e.api.getFocusedCell();
        if (!id || still) return;
        const node = e.api.getRowNode(id);
        const active = document.activeElement;
        const inList = Boolean(wrap.current?.contains(active)) || active === document.body;
        if (!inList || !focused || focused.rowPinned || node?.rowIndex == null || !node.displayed) return;
        if (node.rowIndex !== focused.rowIndex) e.api.setFocusedCell(node.rowIndex, "createdAt");
      },
      onFilterChanged(e: FilterChangedEvent<GridRow>) {
        if (still || !e.columns?.some((c) => c.getColId() === "decision")) return;
        const model = (e.api.getColumnFilterModel("decision") as DecisionModel | null) ?? null;
        if (JSON.stringify(model) !== latest.current.filterJson) latest.current.onDecisionFilter?.(model);
      },
      onRowClicked(e: RowClickedEvent<GridRow>) {
        if (still) {
          if (e.data && isClaim(e.node)) latest.current.onStillClick?.(e.data);
          return;
        }
        if (e.data?.group) return toggleGroup(e.api, e.data.group.key);
        if (!isClaim(e.node)) return;
        const id = e.data!.id;
        // Shift-click picks the claims from the last row to this one; Cmd- or Ctrl-click adds or drops one. A plain click
        // opens the claim and lets the pick go.
        const m = e.event as MouseEvent | null;
        if (m?.shiftKey && latest.current.onPick) return pick.range(e.api, id);
        if ((m?.metaKey || m?.ctrlKey) && latest.current.onPick) return pick.toggle(e.api, id);
        anchor.current = { id, base: [] };
        cursor.current = id;
        if (now.current.length) {
          now.current = [];
          latest.current.onPick?.([]);
        }
        latest.current.onOpen(id);
      },
      onCellKeyDown(e: CellKeyDownEvent<GridRow>) {
        const key = (e.event as KeyboardEvent | null)?.key;
        // A group's heading folds and unfolds like a tree row: Enter or Space toggles, → opens, ← folds.
        if (!still && e.data?.group && (key === "Enter" || key === " " || key === "ArrowRight" || key === "ArrowLeft")) {
          e.event?.preventDefault();
          toggleGroup(e.api, e.data.group.key, key === "ArrowRight" ? true : key === "ArrowLeft" ? false : undefined);
          return;
        }
        // Every other key the list takes is handled as it arrives (the keydown listener above), not here, where AG Grid
        // hands it over late.
      },
      onCellFocused(e: CellFocusedEvent<GridRow>) {
        if (e.rowIndex == null || e.rowPinned) return;
        const node = e.api.getDisplayedRowAtIndex(e.rowIndex);
        if (!isClaim(node)) return;
        keepInView(wrap.current, node!.data!.id);
        // Where the focus is now (this event comes late): the keys above read the grid itself, the cursor follows here
        // for moves they didn't make (a click, AG Grid's own arrows).
        const focused = e.api.getFocusedCell();
        const now = focused && !focused.rowPinned ? e.api.getDisplayedRowAtIndex(focused.rowIndex) : null;
        if (isClaim(now)) cursor.current = now!.data!.id;
        // Shift+↑/↓ picks as it moves (above), and the open panel stays on its claim.
        const moved = ownMoves.current.get(node!.data!.id);
        if (moved !== undefined && performance.now() - moved < 1000) return;
        ownMoves.current.clear();
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
    };
  }, [still, pick]);

  return (
    // While loading, a filled grid clips its skeleton: 12 skeleton rows outgrow a short panel and covered the footer below.
    <div
      ref={wrap}
      className={className ?? (fill ? `claims-grid relative h-full w-full${ready ? "" : " overflow-hidden"}` : "claims-grid relative w-full")}
      aria-busy={!ready || undefined}
      data-still={still || undefined}
      // The Verdict filter is a status tab's (one decision, no reasons): claims-grid.css keeps its icon unlit.
      data-tab-filter={decisionFilter && decisionFilter.decisions.length === 1 && !decisionFilter.reasons.length ? "" : undefined}
    >
      {/* The pick, drawn by row id: picking redraws no cells. */}
      {picked && picked.size > 0 && <style>{pickCss(picked)}</style>}
      {!ready && <SkeletonGrid rows={Math.min(rows.length, 12)} cards={cards} />}
      {width !== null && (
        <div className={ready ? (fill && !cards ? "h-full" : undefined) : "invisible absolute inset-x-0 top-0"}>
          {/* Remounted when the layout switches between cards and columns: AG Grid keeps a rendered row's full-width state. */}
          <AgGridReact<GridRow>
            key={cards ? "cards" : "columns"}
            modules={still ? STILL_MODULES : undefined}
            isExternalFilterPresent={still ? isExternalFilterPresent : undefined}
            doesExternalFilterPass={still ? doesExternalFilterPass : undefined}
            theme={still ? stillTheme : gridTheme}
            rowData={rowData}
            columnDefs={columns}
            getRowId={rowId}
            context={context}
            domLayout={fill && !cards && short === null ? "normal" : "autoHeight"}
            getRowHeight={getRowHeight}
            headerHeight={cards ? 0 : 36}
            isFullWidthRow={isFullWidthRow}
            fullWidthCellRenderer={FullWidthRow}
            quickFilterText={still ? undefined : search}
            quickFilterMatcher={quickMatch}
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
            // The still's rows light up under the pointer too: the homepage lets a visitor touch its grid.
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
          {short !== null && footnote && ready && (
            <p className="absolute inset-x-0 px-4 text-ui text-muted" style={{ top: short + 16 }}>
              {footnote}
            </p>
          )}
        </div>
      )}
    </div>
  );
});

/** The picked rows' tint and their check box in place of the photos (claims-grid.css draws both), by row id. Ids are
 * RM-0000: nothing to escape. */
function pickCss(picked: ReadonlySet<string>) {
  const rows = [...picked].filter((id) => /^[A-Za-z0-9_-]+$/.test(id)).map((id) => `.claims-grid .ag-row[row-id="${id}"]`);
  if (!rows.length) return "";
  return `${rows.join(",")}{--row-picked:1}${rows.map((r) => `${r} .ag-cell`).join(",")}{background-color:var(--pick-bg)}${rows.map((r) => `${r} .pick-box`).join(",")}{opacity:1}${rows.map((r) => `${r} .thumbs`).join(",")}{opacity:0}`;
}

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
      return verdictWord(verdictOf(r));
    case "reason":
      return reasonKey(r);
    case "checks":
      // The five checks, counted as the grid's strip, its hover card and the panel count them.
      return r.bars ? barsSentence(r.bars) : "";
    case "time":
      return r.modelSec === null ? "" : String(r.modelSec);
    case "toPay":
      return r.toPay === null ? "" : String(r.toPay);
    case "payer":
      return r.payer.replace(/•/g, "*");
    case "payoutStatus":
      return payoutWord(r) ?? "";
    case "amount":
      return r.cents === null ? "" : (r.cents / 100).toFixed(2);
  }
  return "";
}

