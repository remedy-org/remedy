"use client";

import {
  CellStyleModule,
  ClientSideRowModelModule,
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
  type RowClickedEvent,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ClaimRow } from "@/app/console/_lib/view";
import { AmountCell, CardRow, ChecksCell, ClaimCell, PayerCell, PayoutCell, PhotoTooltip, TimelineCell, VerdictCell } from "./cells";
import { SkeletonGrid } from "./ConsoleSkeleton";
import { gridTheme } from "./gridTheme";
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

// Below this width the grid shows one card per claim (phones, narrow windows).
export const CARD_BELOW = 720;
// Columns that come and go with the grid's width (the evidence panel takes 452px). The rest need 708px: claim 220,
// verdict at least 260 (144 in the homepage's narrower still, which keeps columns down to 592px), checks 132, amount 96. Each optional column is added, in
// order, while it fits: the queue keeps its timeline first; the still keeps the payout column, where sample claims say
// "not sent".
const VERDICT_MIN = { queue: 260, still: 144 };
const BASE = 220 + 132 + 96;
const OPTIONAL: Record<string, number> = { timeline: 168, payoutStatus: 112, payer: 132 };
const ORDER = { queue: ["timeline", "payoutStatus", "payer"], still: ["payoutStatus", "timeline", "payer"] };

function hiddenAt(width: number, still: boolean): Set<string> {
  const order = still ? ORDER.still : ORDER.queue;
  let room = width - BASE - (still ? VERDICT_MIN.still : VERDICT_MIN.queue);
  const hidden = new Set<string>();
  for (const id of order) {
    if (room >= OPTIONAL[id]) room -= OPTIONAL[id];
    else hidden.add(id);
  }
  return hidden;
}

export interface ClaimsGridHandle {
  /** Puts keyboard focus back on a claim's row (after the panel closes). */
  focusRow(id: string): void;
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
  className?: string;
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const ClaimsGrid = forwardRef<ClaimsGridHandle, ClaimsGridProps>(function ClaimsGrid(
  { rows, openId, onOpen, onFocusRow, fill = false, still = false, className },
  ref,
) {
  const wrap = useRef<HTMLDivElement>(null);
  const api = useRef<GridApi<ClaimRow> | null>(null);
  // Unknown until measured, so the grid mounts in its final layout (cards or columns) and never jumps.
  const [width, setWidth] = useState<number | null>(null);
  // AG Grid paints nothing until its script runs; the skeleton holds the grid's footprint until the first rows.
  const [ready, setReady] = useState(false);
  const [animate] = useState(() => !reducedMotion());

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
      grid.setFocusedCell(node.rowIndex, cards ? "id" : "createdAt");
    },
  }));

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
        headerName: "Claim",
        field: "createdAt",
        cellRenderer: ClaimCell,
        width: 220,
        pinned: "left",
        lockPinned: true,
        sortable: !still,
        // The queue is newest first; the homepage's still keeps the order its rows come in (curated in preview.ts).
        sort: still ? undefined : "desc",
        tooltip: (p) => (!still && p.data?.photos.length ? p.data.id : undefined),
        tooltipComponent: PhotoTooltip,
      },
      {
        colId: "decision",
        headerName: "Verdict",
        field: "decision",
        cellRenderer: VerdictCell,
        flex: 1,
        minWidth: still ? VERDICT_MIN.still : VERDICT_MIN.queue,
        enableCellChangeFlash: true,
      },
      {
        colId: "checks",
        headerName: "Checks",
        cellRenderer: ChecksCell,
        width: 132,
      },
      {
        colId: "timeline",
        headerName: "Timeline",
        cellRenderer: TimelineCell,
        width: 168,
        sortable: true,
        valueGetter: (p) => p.data?.toPay ?? null,
        // Unpaid claims last, whichever way.
        comparator: (a: number | null, b: number | null, _na, _nb, desc) =>
          a === null ? (b === null ? 0 : desc ? -1 : 1) : b === null ? (desc ? 1 : -1) : a - b,
      },
      {
        colId: "payer",
        headerName: "PayPal",
        field: "payer",
        cellRenderer: PayerCell,
        width: 132,
      },
      {
        colId: "payoutStatus",
        headerName: "Payout",
        field: "payoutStatus",
        cellRenderer: PayoutCell,
        width: 112,
        enableCellChangeFlash: true,
      },
      {
        colId: "amount",
        headerName: "Amount",
        field: "cents",
        cellRenderer: AmountCell,
        width: 96,
        pinned: "right",
        lockPinned: true,
        sortable: true,
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
  }, [hidden, still]);

  const focusTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(focusTimer.current), []);

  return (
    <div ref={wrap} className={className ?? (fill ? "claims-grid relative h-full w-full" : "claims-grid relative w-full")} aria-busy={!ready || undefined}>
      {!ready && <SkeletonGrid rows={Math.min(rows.length, 12)} cards={cards} />}
      {width !== null && (
        <div className={ready ? (fill && !cards ? "h-full" : undefined) : "invisible absolute inset-x-0 top-0"}>
          {/* Remounted when the layout switches between cards and columns: AG Grid keeps a rendered row's full-width state. */}
          <AgGridReact<ClaimRow>
            key={cards ? "cards" : "columns"}
            theme={gridTheme}
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
            onFirstDataRendered={() => setReady(true)}
            onRowClicked={(e: RowClickedEvent<ClaimRow>) => !still && e.data && onOpen(e.data.id)}
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
            // The homepage's still is a picture: no cell or header takes focus, so Tab goes past it in one step.
            suppressCellFocus={still}
            suppressHeaderFocus={still}
            tabToNextCell={still ? () => false : undefined}
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
