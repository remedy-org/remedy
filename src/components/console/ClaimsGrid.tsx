"use client";

import {
  CellStyleModule,
  ClientSideRowModelApiModule,
  ClientSideRowModelModule,
  ColumnApiModule,
  CsvExportModule,
  CustomFilterModule,
  HighlightChangesModule,
  ModuleRegistry,
  NumberFilterModule,
  PinnedRowModule,
  QuickFilterModule,
  RowApiModule,
  RowSelectionModule,
  RowStyleModule,
  ScrollApiModule,
  TextFilterModule,
  TooltipModule,
  ValidationModule,
  type CellFocusedEvent,
  type CellKeyDownEvent,
  type ColDef,
  type GridApi,
  type IRowNode,
  type RowClickedEvent,
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
  TotalRow,
  verdictLabel,
  VerdictCell,
  type GridContext,
  type GridRow,
  type GroupStats,
  type GroupTotal,
} from "./cells";
import { SkeletonGrid } from "./ConsoleSkeleton";
import { DecisionFilter, reasonKey, type DecisionModel } from "./DecisionFilter";
import { formatDate } from "./format";
import { gridTheme } from "./gridTheme";
import "./claims-grid.css";

// Community modules only (no Enterprise, no licence): filters (text, number, the Verdict column's own, the quick
// filter behind search), pinned totals, CSV export, the column API the tabs use to set the Verdict filter, photo
// tooltips and the payout cell flash. Group by is built from full-width rows, which are Community too.
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
  TextFilterModule,
  NumberFilterModule,
  CustomFilterModule,
  QuickFilterModule,
  PinnedRowModule,
  CsvExportModule,
  ColumnApiModule,
  ...(process.env.NODE_ENV !== "production" ? [ValidationModule] : []),
]);

// Below this width the grid shows one card per claim (phones, narrow windows).
export const CARD_BELOW = 720;
// Columns that come and go with the grid's width (the evidence panel takes 452px). The rest need claim 220, checks 136
// and amount 96, plus the verdict: at least 260 (144 in the homepage's still, which keeps columns down to 592px). Each
// optional column is added, in order, while it fits; in the queue only while the verdict keeps 360px, room for a reason
// like "Couldn't tell if both photos show the same item" beside its pill: the reason is what a reviewer reads first.
const VERDICT_MIN = { queue: 260, still: 144 };
const VERDICT_WANT = { queue: 360, still: 144 };
const VERDICT_MAX = 560;
const BASE = 220 + 136 + 96;
const OPTIONAL = {
  queue: { time: 88, payoutStatus: 200, payer: 132 } as Record<string, number>,
  still: { time: 88, payoutStatus: 112, payer: 132 } as Record<string, number>,
};
const ORDER = { queue: ["time", "payoutStatus", "payer"], still: ["payoutStatus", "time", "payer"] };

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
  if (by === "reason") return { key: reasonKey(r), label: reasonKey(r) };
  if (by === "code") return r.code ? { key: r.code, label: `Code ${r.code}` } : { key: "~", label: "No code" };
  const day = r.createdAt.slice(0, 10);
  return { key: day, label: `Filed ${formatDate(day)}` };
}

const DECISION_ORDER: Record<ClaimRow["decision"], number> = { held: 0, pending: 1, paid: 2, rejected: 3, blocked: 4 };

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
}

export interface ClaimsGridProps {
  rows: ClaimRow[];
  /** The claim whose evidence is open: its row is selected (a surface step up, ink edge). */
  openId: string | null;
  onOpen: (id: string) => void;
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
  /** How many claims the grid shows after its filters. */
  onShown?: (count: number) => void;
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

/** Full-width rows: the pinned totals, a group's heading, or a whole claim as a card. */
function FullWidthRow(p: CustomCellRendererProps<GridRow, unknown, GridContext>) {
  if (p.node.rowPinned) return <TotalRow data={p.data?.total} />;
  if (p.data?.group) return <GroupRow {...p} />;
  return <CardRow {...p} />;
}

const isClaim = (n: IRowNode<GridRow> | null | undefined) => Boolean(n?.data && !n.data.group && !n.rowPinned);

export const ClaimsGrid = forwardRef<ClaimsGridHandle, ClaimsGridProps>(function ClaimsGrid(
  { rows, openId, onOpen, onFocusRow, fill = false, still = false, oldestFirst = false, search = "", decisionFilter, onDecisionFilter, groupBy = "none", onShown, onReady, className },
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
  const [total, setTotal] = useState<{ count: number; approvedCents: number; sentCents: number } | null>(null);

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
  const rowData = useMemo<GridRow[]>(() => {
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
  const context = useMemo<GridContext>(() => ({ stacked: still, slots, groups: stats }), [still, slots, stats]);

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
    exportCsv() {
      api.current?.exportDataAsCsv({
        fileName: `remedy-claims-${new Date().toISOString().slice(0, 10)}.csv`,
        allColumns: true,
        skipPinnedBottom: true,
        columnKeys: ["createdAt", "filedAt", "code", "decision", "reason", "checks", "time", "payer", "payoutStatus", "amount"],
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
        filter: still ? undefined : "agTextColumnFilter",
        filterValueGetter: (p) => (p.data ? `${p.data.id} ${p.data.code ?? ""}` : ""),
        filterParams: { filterOptions: ["contains", "startsWith", "equals"], maxNumConditions: 1, buttons: ["clear"] },
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
        // Twice the payout column's share of the spare width, up to 560px: the reason is what a reviewer reads first.
        flex: 2,
        minWidth: still ? VERDICT_MIN.still : VERDICT_MIN.queue,
        maxWidth: still ? undefined : VERDICT_MAX,
        sortable: !still,
        sortingOrder: ["asc", "desc", null],
        comparator: (_a, _b, na, nb) =>
          na.data && nb.data ? DECISION_ORDER[na.data.decision] - DECISION_ORDER[nb.data.decision] || reasonKey(na.data).localeCompare(reasonKey(nb.data)) : 0,
        filter: still ? undefined : DecisionFilter,
        enableCellChangeFlash: true,
        // The flash is the paid colour only when the claim became paid; any other change (a refused approve, a reject)
        // flashes neutral, since no money moved (claims-grid.css).
        cellClass: (p) => (p.data?.decision === "paid" ? undefined : "flash-neutral"),
        getQuickFilterText: () => "",
      },
      {
        colId: "checks",
        headerName: "Checks",
        headerTooltip: still ? undefined : "The four pre-checks, then the model's answers. Filled passed, half held, slashed failed, outline waiting, dotted not run.",
        cellRenderer: ChecksCell,
        width: 136,
        tooltip: (p) => (!still && p.data?.bars ? p.data.id : undefined),
        tooltipComponent: ChecksTooltip,
        getQuickFilterText: () => "",
      },
      {
        colId: "time",
        headerName: "Time",
        headerTooltip: still ? undefined : "Photos to PayPal payout. With no payout to time, the model's answer time, in grey.",
        cellRenderer: TimeCell,
        width: 88,
        type: "rightAligned",
        tooltip: (p) => (!still && p.data?.timeline ? p.data.id : undefined),
        tooltipComponent: TimelineTooltip,
        sortable: !still,
        valueGetter: (p) => p.data?.toPay ?? p.data?.modelSec ?? null,
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
        ...(still ? { width: OPTIONAL.still.payoutStatus } : { flex: 1, minWidth: OPTIONAL.queue.payoutStatus }),
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
        pinned: "right",
        lockPinned: true,
        suppressMovable: true,
        sortable: !still,
        type: "rightAligned",
        filter: still ? undefined : "agNumberColumnFilter",
        // In dollars, as the column reads; a refused claim owes nothing.
        filterValueGetter: (p) => (p.data?.cents ?? 0) / 100,
        filterParams: { filterOptions: ["greaterThan", "lessThan", "equals", "inRange"], maxNumConditions: 1, buttons: ["clear"] },
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
        const g = groups.get(key) ?? { count: 0, cents: 0 };
        groups.set(key, { count: g.count + 1, cents: g.cents + (r.decision === "paid" || r.decision === "held" ? (r.cents ?? 0) : 0) });
      }
    });
    stats.set(groups);
    setTotal((t) => (t && t.count === count && t.approvedCents === approvedCents && t.sentCents === sentCents ? t : { count, approvedCents, sentCents }));
    onShown?.(count);
  };

  const pinned = useMemo(() => (still || !total || cards ? undefined : [{ id: "__total", total } as unknown as GridRow]), [still, total, cards]);

  const focusTimer = useRef<number | undefined>(undefined);
  const measureTimer = useRef<number | undefined>(undefined);
  useEffect(
    () => () => {
      window.clearTimeout(focusTimer.current);
      window.clearTimeout(measureTimer.current);
    },
    [],
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
            getRowId={(p) => p.data.id}
            context={context}
            domLayout={fill && !cards ? "normal" : "autoHeight"}
            getRowHeight={(p) => (p.node.rowPinned ? 36 : p.data?.group ? 40 : cards ? 72 : 52)}
            headerHeight={cards ? 0 : 36}
            isFullWidthRow={(p) => cards || Boolean(p.rowNode.data?.group) || Boolean(p.rowNode.rowPinned)}
            fullWidthCellRenderer={FullWidthRow}
            pinnedBottomRowData={pinned}
            quickFilterText={still ? undefined : search}
            cacheQuickFilter
            // A group's heading stays while any of its claims pass; postSortRows drops a heading left with none.
            alwaysPassFilter={(n) => Boolean(n.data?.group)}
            postSortRows={(p) => {
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
              p.nodes.splice(0, p.nodes.length, ...keys.flatMap((k) => [heads.get(k)!, ...members.get(k)!]));
            }}
            rowSelection={{
              mode: "singleRow",
              checkboxes: false,
              enableClickSelection: false,
              isRowSelectable: (n) => isClaim(n),
            }}
            tooltipShowDelay={250}
            tooltipHideDelay={8000}
            onGridReady={(e) => {
              api.current = e.api;
              if (openId) e.api.getRowNode(openId)?.setSelected(true, true);
              if (decisionFilter) e.api.setColumnFilterModel("decision", decisionFilter).then(() => e.api.onFilterChanged());
            }}
            onFirstDataRendered={(e) => {
              setReady(true);
              onReady?.();
              // A deep link (/console?claim=RM-1460) opens with its row in view: after this render pass, since
              // scrolling redraws the rows.
              const n = openId && !still ? e.api.getRowNode(openId)?.rowIndex : null;
              if (n != null) window.setTimeout(() => !e.api.isDestroyed() && e.api.ensureIndexVisible(n, "middle"), 0);
            }}
            // Measured after the grid's own render pass: setting React state inside it would flush mid-render.
            onModelUpdated={(e) => {
              window.clearTimeout(measureTimer.current);
              measureTimer.current = window.setTimeout(() => measure(e.api), 0);
            }}
            onFilterChanged={(e) => {
              if (still || !e.columns?.some((c) => c.getColId() === "decision")) return;
              const model = (e.api.getColumnFilterModel("decision") as DecisionModel | null) ?? null;
              if (JSON.stringify(model) !== filterJson) onDecisionFilter?.(model);
            }}
            onRowClicked={(e: RowClickedEvent<GridRow>) => !still && isClaim(e.node) && onOpen(e.data!.id)}
            onCellKeyDown={(e: CellKeyDownEvent<GridRow>) => {
              const key = (e.event as KeyboardEvent | null)?.key;
              if (!still && (key === "Enter" || key === " ") && isClaim(e.node)) {
                e.event?.preventDefault();
                onOpen(e.data!.id);
              }
            }}
            onCellFocused={(e: CellFocusedEvent<GridRow>) => {
              if (!onFocusRow || e.rowIndex == null || e.rowPinned) return;
              const node = e.api.getDisplayedRowAtIndex(e.rowIndex);
              if (!isClaim(node)) return;
              const id = node!.data!.id;
              // Holding ↓ walks many rows: the panel follows only where the focus settles (120ms).
              window.clearTimeout(focusTimer.current);
              focusTimer.current = window.setTimeout(() => onFocusRow(id), 120);
            }}
            getRowClass={(p) => (still || !isClaim(p.node) ? undefined : "cursor-pointer")}
            // Nor does a row light up under the pointer: the still's rows open nothing.
            suppressRowHoverHighlight={still}
            // The homepage's still is a picture: no cell or header takes focus. In both, Tab leaves the grid in one step
            // (to the evidence panel and the footer); the arrow keys move between cells.
            // Card rows have no header (0px tall): it must never be a tab stop. A full-width row is focused through its
            // first column, the claim's, which every layout keeps.
            suppressCellFocus={still}
            suppressHeaderFocus={still || cards}
            tabToNextCell={() => false}
            focusGridInnerElement={(p) => {
              if (still || !p.api.getDisplayedRowCount()) return false;
              let row = (openRef.current ? p.api.getRowNode(openRef.current)?.rowIndex : null) ?? -1;
              if (row < 0) for (row = 0; row < p.api.getDisplayedRowCount() && !isClaim(p.api.getDisplayedRowAtIndex(row)); row++);
              p.api.ensureIndexVisible(row);
              p.api.setFocusedCell(row, "createdAt");
              return true;
            }}
            overlayNoRowsTemplate="<span></span>"
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
  decision: "Decision",
  reason: "Reason",
  checks: "Checks",
  time: "Photos to payout (s)",
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
      return r.toPay === null ? "" : String(r.toPay);
    case "payer":
      return r.payer.replace(/•/g, "*");
    case "payoutStatus":
      return r.payoutFailedAt ? "Not sent (PayPal refused)" : sent(r) ? (r.payoutStatus ?? "") : r.decision === "paid" ? "Not sent" : "";
    case "amount":
      return r.cents === null ? "" : (r.cents / 100).toFixed(2);
  }
  return "";
}

