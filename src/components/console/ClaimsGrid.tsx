"use client";

import {
  CellStyleModule,
  ClientSideRowModelApiModule,
  ClientSideRowModelModule,
  ColumnApiModule,
  ExternalFilterModule,
  HighlightChangesModule,
  ModuleRegistry,
  RowApiModule,
  RowSelectionModule,
  RowStyleModule,
  ScrollApiModule,
  TooltipModule,
  ValidationModule,
  type CellFocusedEvent,
  type CellKeyDownEvent,
  type ColDef,
  type GridApi,
  type IRowNode,
  type Module,
  type RowClickedEvent,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ClaimRow } from "@/app/console/_lib/view";
import { AmountCell, CardRow, ChecksCell, ChecksTooltip, ClaimCell, PayerCell, PayoutCell, PhotoTooltip, TimelineCell, TimelineTooltip, VerdictCell } from "./cells";
import { SkeletonGrid } from "./ConsoleSkeleton";
import { gridTheme, stillTheme } from "./gridTheme";
import "./claims-grid.css";

// Community modules only (no Enterprise): photo tooltips and the payout cell flash on top of the core, and the scroll
// API, which focusRow's ensureIndexVisible needs (without it a production build logs AG Grid error #200 when the
// panel closes). The search filters rows before they reach the grid (ClaimsQueue), which costs less JS than
// QuickFilterModule.
ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  RowApiModule,
  RowSelectionModule,
  RowStyleModule,
  ScrollApiModule,
  CellStyleModule,
  TooltipModule,
  HighlightChangesModule,
  ...(process.env.NODE_ENV !== "production" ? [ValidationModule] : []),
]);

// The homepage's still filters its rows in place (the tour's Held step) and takes a claim's arrival as a transaction, so
// AG Grid's row animation shows the queue narrowing and the row coming in. Registered on that grid only, through its
// own `modules`: the console's queue filters before the grid and replaces its rows.
// It also puts back its curated order when a visitor's sort is undone (applyColumnState).
const STILL_MODULES: Module[] = [ExternalFilterModule, ClientSideRowModelApiModule, ColumnApiModule];

// Below this width the grid shows one card per claim (phones, narrow windows).
export const CARD_BELOW = 720;
// Columns that come and go with the grid's width (the evidence panel takes 452px). The rest need 708px: claim 220,
// verdict at least 260 (144 in the homepage's narrower still, which keeps columns down to 592px), checks 132, amount 96. Each optional column is added, in
// order, while it fits: the queue keeps its timeline first; the still keeps the payout column, where sample claims say
// "not sent". In the queue they join strictly in that order, and only while the verdict keeps 360px, room for a reason
// like "Couldn't tell if both photos show the same item" beside its pill: the reason is what a reviewer reads first.
const VERDICT_MIN = { queue: 260, still: 144 };
const VERDICT_WANT = { queue: 360, still: 144 };
const BASE = 220 + 132 + 96;
// The still's PayPal column is wider: "•••• 78AV" and "Unverified" side by side, never cut mid-word.
const PAYER = { queue: 132, still: 172 };
const OPTIONAL = (still: boolean): Record<string, number> => ({ timeline: 168, payoutStatus: 112, payer: still ? PAYER.still : PAYER.queue });
const ORDER = { queue: ["timeline", "payoutStatus", "payer"], still: ["payoutStatus", "timeline", "payer"] };

function hiddenAt(width: number, still: boolean): Set<string> {
  const order = still ? ORDER.still : ORDER.queue;
  let room = width - BASE - (still ? VERDICT_WANT.still : VERDICT_WANT.queue);
  const hidden = new Set<string>();
  const optional = OPTIONAL(still);
  for (const id of order) {
    if ((still || !hidden.size) && room >= optional[id]) room -= optional[id];
    else hidden.add(id);
  }
  return hidden;
}

export interface ClaimsGridHandle {
  /** Puts keyboard focus back on a claim's row (after the panel closes). */
  focusRow(id: string): void;
  /** Puts keyboard focus on the first row (↓ or j from outside the grid). */
  focusFirst(): void;
  /** The claim whose row has keyboard focus, if any (A and R act on it). */
  focusedRowId(): string | null;
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
  /** The homepage's still: selects a claim's row (the open row's tint and edge) and scrolls it into view; null clears. */
  open(id: string | null): void;
  /** The homepage's still: back to the order its rows came in (a visitor's sort undone). */
  resetSort(): void;
}

export interface ClaimsGridProps {
  rows: ClaimRow[];
  /** The claim whose evidence is open: its row is selected (tinted, amber edge). */
  openId: string | null;
  onOpen: (id: string) => void;
  /** A row took keyboard focus (↑/↓): the panel follows it while open. */
  onFocusRow?: (id: string) => void;
  /** Fill the parent's height (laptops) instead of growing with the rows. */
  fill?: boolean;
  /** Read only (the homepage preview): no keyboard opening, no tooltips. */
  still?: boolean;
  /** Sort oldest first (the held tab: the longest waiting leads) instead of newest first. */
  oldestFirst?: boolean;
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

export const ClaimsGrid = forwardRef<ClaimsGridHandle, ClaimsGridProps>(function ClaimsGrid(
  { rows, openId, onOpen, onFocusRow, fill = false, still = false, oldestFirst = false, onReady, onStillClick, stillOpens, stillTips = false, className },
  ref,
) {
  const wrap = useRef<HTMLDivElement>(null);
  const api = useRef<GridApi<ClaimRow> | null>(null);
  // Unknown until measured, so the grid mounts in its final layout (cards or columns) and never jumps.
  const [width, setWidth] = useState<number | null>(null);
  // AG Grid paints nothing until its script runs; the skeleton holds the grid's footprint until the first rows.
  const [ready, setReady] = useState(false);
  const [animate] = useState(() => !reducedMotion());
  const filter = useRef<((row: ClaimRow) => boolean) | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

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
      if (!grid?.getDisplayedRowCount()) return;
      grid.ensureIndexVisible(0);
      grid.setFocusedCell(0, "createdAt");
    },
    focusedRowId() {
      const cell = api.current?.getFocusedCell();
      if (!cell || cell.rowPinned) return null;
      return api.current?.getDisplayedRowAtIndex(cell.rowIndex)?.data?.id ?? null;
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
    open(id) {
      const grid = api.current;
      if (!grid) return;
      if (!id) return grid.deselectAll();
      const node = grid.getRowNode(id);
      node?.setSelected(true, true);
      if (node?.rowIndex != null) grid.ensureIndexVisible(node.rowIndex);
    },
    resetSort() {
      api.current?.applyColumnState({ defaultState: { sort: null } });
    },
  }));

  // Tab into the grid lands on a row (the open claim's, else the first), not on each column header in turn; ↑ from the
  // first row still reaches the headers to sort.
  const openRef = useRef(openId);
  useEffect(() => {
    openRef.current = openId;
  }, [openId]);

  // The panel owns the selection: closing it clears the tint.
  useEffect(() => {
    const grid = api.current;
    if (!grid) return;
    if (!openId) grid.deselectAll();
    else grid.getRowNode(openId)?.setSelected(true, true);
  }, [openId, rows]);

  const columns = useMemo<ColDef<ClaimRow>[]>(() => {
    const all: ColDef<ClaimRow>[] = [
      {
        colId: "createdAt",
        // The second line's time is UTC (cells.tsx): said once here, so every row's line fits the column. The homepage's
        // still names the column alone, in the sans face.
        headerName: still ? "Claim" : "Claim · UTC",
        field: "createdAt",
        cellRenderer: ClaimCell,
        width: 220,
        pinned: "left",
        lockPinned: true,
        sortable: true,
        // The queue is newest first, the held tab oldest first; the homepage's still keeps the order its rows come in
        // (curated in preview.ts) until a visitor sorts it, and a third click on the header gives that order back. In
        // the queue a header click flips the order, with no unsorted step between.
        sort: still ? undefined : oldestFirst ? "asc" : "desc",
        sortingOrder: still ? ["desc", "asc", null] : ["desc", "asc"],
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
        flex: 1,
        minWidth: still ? VERDICT_MIN.still : VERDICT_MIN.queue,
        // The homepage's still sorts by verdict too (paid, held, refused: a visitor's quickest check that it's a grid).
        sortable: still,
        sortingOrder: ["asc", "desc", null],
        enableCellChangeFlash: true,
        // The flash is the paid colour only when the claim became paid; any other change (a refused approve, a reject)
        // flashes neutral, since no money moved (claims-grid.css).
        cellClass: (p) => (p.data?.decision === "paid" ? undefined : "flash-neutral"),
      },
      {
        colId: "checks",
        headerName: "Checks",
        headerTooltip: still ? undefined : "One bar per check: the four before the model, then the model's. Solid passed, half-filled held, slashed failed, outline waiting, dotted not run.",
        cellRenderer: ChecksCell,
        width: 132,
        tooltip: (p) => ((!still || stillTips) && p.data?.bars ? p.data.id : undefined),
        tooltipComponent: ChecksTooltip,
      },
      {
        colId: "timeline",
        headerName: "Timeline",
        headerTooltip: still
          ? undefined
          : "From the photos arriving to PayPal settling, on a 2-minute scale: the model's answer, the rule's decision, PayPal sent and settled. The boxed time is photos to payout; a grey time, the model's answer alone (no payout to time).",
        cellRenderer: TimelineCell,
        width: 168,
        tooltip: (p) => (!still && p.data?.timeline ? p.data.id : undefined),
        tooltipComponent: TimelineTooltip,
        sortable: true,
        valueGetter: (p) => p.data?.toPay ?? null,
        // A sample claim never times a payout (toPay stays null), so its value never changes: the still redraws the
        // track whenever its row does (the homepage's arrival, whose track appears as its checks come back).
        equals: still ? () => false : undefined,
        // Unpaid claims last, whichever way.
        comparator: (a: number | null, b: number | null, _na, _nb, desc) =>
          a === null ? (b === null ? 0 : desc ? -1 : 1) : b === null ? (desc ? 1 : -1) : a - b,
      },
      {
        colId: "payer",
        headerName: "PayPal",
        field: "payer",
        cellRenderer: PayerCell,
        width: still ? PAYER.still : PAYER.queue,
      },
      {
        colId: "payoutStatus",
        headerName: "Payout",
        valueGetter: (p) => (p.data ? (p.data.payoutFailedAt ? `not sent ${p.data.payoutFailedAt}` : p.data.payoutStatus) : null),
        cellRenderer: PayoutCell,
        width: 112,
        enableCellChangeFlash: true,
        // A sample claim the rule decided to pay flashes paid too (the homepage's arrival): the verdict beside it says
        // paid, and the cell itself says "Sample / not sent".
        cellClass: (p) => (p.data?.payoutStatus === "SUCCESS" || (p.data?.seeded && p.data.decision === "paid") ? undefined : "flash-neutral"),
      },
      {
        colId: "amount",
        headerName: "Amount",
        field: "cents",
        cellRenderer: AmountCell,
        width: 96,
        pinned: "right",
        lockPinned: true,
        // The homepage's still pays one refund per unit, so every amount is the same: sorting it would look broken.
        sortable: !still,
        type: "rightAligned",
      },
    ];
    return all.map((c) => ({
      sortable: false,
      resizable: false,
      suppressMovable: true,
      hide: hidden.has(c.colId ?? ""),
      ...c,
    }));
  }, [hidden, still, oldestFirst, stillTips]);

  const focusTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(focusTimer.current), []);

  return (
    // While loading, a filled grid clips its skeleton: 12 skeleton rows outgrow a short panel and covered the footer below.
    <div
      ref={wrap}
      className={className ?? (fill ? `claims-grid relative h-full w-full${ready ? "" : " overflow-hidden"}` : "claims-grid relative w-full")}
      aria-busy={!ready || undefined}
      data-still={still || undefined}
    >
      {!ready && <SkeletonGrid rows={Math.min(rows.length, 12)} cards={cards} />}
      {width !== null && (
        <div className={ready ? (fill && !cards ? "h-full" : undefined) : "invisible absolute inset-x-0 top-0"}>
          {/* Remounted when the layout switches between cards and columns: AG Grid keeps a rendered row's full-width state. */}
          <AgGridReact<ClaimRow>
            key={cards ? "cards" : "columns"}
            modules={still ? STILL_MODULES : undefined}
            isExternalFilterPresent={still ? () => filter.current !== null : undefined}
            doesExternalFilterPass={still ? (node: IRowNode<ClaimRow>) => (node.data ? (filter.current?.(node.data) ?? true) : true) : undefined}
            theme={still ? stillTheme : gridTheme}
            rowData={rows}
            columnDefs={columns}
            getRowId={(p) => p.data.id}
            context={{ stacked: still }}
            domLayout={fill && !cards ? "normal" : "autoHeight"}
            rowHeight={cards ? 72 : 52}
            headerHeight={cards ? 0 : 36}
            isFullWidthRow={() => cards}
            fullWidthCellRenderer={CardRow}
            rowSelection={{
              mode: "singleRow",
              checkboxes: false,
              enableClickSelection: false,
            }}
            tooltipShowDelay={250}
            tooltipHideDelay={8000}
            onGridReady={(e) => {
              api.current = e.api;
              if (openId) e.api.getRowNode(openId)?.setSelected(true, true);
            }}
            onFirstDataRendered={(e) => {
              setReady(true);
              onReady?.();
              // A deep link (/console?claim=RM-1460) opens with its row in view.
              const n = openId ? e.api.getRowNode(openId)?.rowIndex : null;
              if (n != null) e.api.ensureIndexVisible(n, "middle");
            }}
            onRowClicked={(e: RowClickedEvent<ClaimRow>) => e.data && (still ? onStillClick?.(e.data) : onOpen(e.data.id))}
            onCellKeyDown={(e: CellKeyDownEvent<ClaimRow>) => {
              const key = (e.event as KeyboardEvent | null)?.key;
              if (!still && (key === "Enter" || key === " ") && e.data) {
                e.event?.preventDefault();
                onOpen(e.data.id);
              }
            }}
            onCellFocused={(e: CellFocusedEvent<ClaimRow>) => {
              if (!onFocusRow || e.rowIndex == null || e.rowPinned) return;
              const id = e.api.getDisplayedRowAtIndex(e.rowIndex)?.data?.id;
              if (!id) return;
              // Holding ↓ walks many rows: the panel follows only where the focus settles (120ms).
              window.clearTimeout(focusTimer.current);
              focusTimer.current = window.setTimeout(() => onFocusRow(id), 120);
            }}
            rowClass={still ? undefined : "cursor-pointer"}
            getRowClass={still && stillOpens ? (p) => (p.data && stillOpens(p.data) ? "cursor-pointer" : undefined) : undefined}
            // The still's rows light up under the pointer when the homepage lets the visitor touch the grid (it is inert
            // otherwise, so nothing hovers); they open nothing.
            // The homepage's still is a picture: no cell or header takes focus. In both, Tab leaves the grid in one step
            // (to the evidence panel and the footer); the arrow keys move between cells.
            // Card rows have no header (0px tall): it must never be a tab stop. A full-width row is focused through its
            // first column, the claim's, which every layout keeps.
            suppressCellFocus={still}
            suppressHeaderFocus={still || cards}
            tabToNextCell={() => false}
            focusGridInnerElement={(p) => {
              if (still || !p.api.getDisplayedRowCount()) return false;
              const row = (openRef.current ? p.api.getRowNode(openRef.current)?.rowIndex : null) ?? 0;
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
