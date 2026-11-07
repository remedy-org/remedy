"use client";

import {
  CellStyleModule,
  ClientSideRowModelModule,
  ModuleRegistry,
  RowApiModule,
  RowSelectionModule,
  RowStyleModule,
  ValidationModule,
  type ColDef,
  type GridApi,
  type RowClickedEvent,
  type CellKeyDownEvent,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ClaimRow } from "@/app/console/_lib/view";
import { AmountCell, ClaimCell, DecisionCell, FiledCell, PayerCell, PayoutCell, ReasonCell } from "./cells";
import { SkeletonGrid } from "./ConsoleSkeleton";
import { gridTheme } from "./gridTheme";

ModuleRegistry.registerModules([ClientSideRowModelModule, RowApiModule, RowSelectionModule, RowStyleModule, CellStyleModule, ...(process.env.NODE_ENV !== "production" ? [ValidationModule] : [])]);

// Below this width the grid keeps three columns: claim (with its time), decision and amount.
const NARROW = 720;
const WIDE_ONLY = new Set(["createdAt", "payer", "reason", "payoutStatus"]);

export interface ClaimsGridProps {
  rows: ClaimRow[];
  selected: string | null;
  onOpen: (id: string) => void;
}

export function ClaimsGrid({ rows, selected, onOpen }: ClaimsGridProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const api = useRef<GridApi<ClaimRow> | null>(null);
  // Unknown until measured: the grid mounts at its final row height, so a phone never sees 44px rows jump to 56px.
  const [narrow, setNarrow] = useState<boolean | null>(null);
  // AG Grid paints nothing until its script runs; the skeleton holds the grid's exact footprint until the first rows.
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    setNarrow(el.getBoundingClientRect().width < NARROW);
    const ro = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < NARROW));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The drawer owns the selection: closing it clears the tint.
  useEffect(() => {
    const grid = api.current;
    if (!grid) return;
    if (!selected) grid.deselectAll();
    else grid.getRowNode(selected)?.setSelected(true, true);
  }, [selected]);

  const columns = useMemo<ColDef<ClaimRow>[]>(() => {
    const all: ColDef<ClaimRow>[] = [
      { headerName: "Claim", field: "id", cellRenderer: ClaimCell, minWidth: narrow ? 116 : 170, flex: narrow ? 1 : 0, width: 170 },
      { headerName: "Filed", field: "createdAt", cellRenderer: FiledCell, width: 140, sortable: true, sort: "desc" },
      { headerName: "PayPal account", field: "payer", cellRenderer: PayerCell, width: 190 },
      { headerName: "Decision", field: "decision", cellRenderer: DecisionCell, width: narrow ? 116 : 130 },
      { headerName: "Reason", field: "reason", cellRenderer: ReasonCell, flex: 1, minWidth: 220 },
      { headerName: "Payout", field: "payoutStatus", cellRenderer: PayoutCell, width: 120 },
      {
        headerName: "Amount",
        field: "amount",
        cellRenderer: AmountCell,
        width: narrow ? 84 : 110,
        type: "rightAligned",
        cellClass: "!flex items-center justify-end",
      },
    ];
    return all.filter((c) => !narrow || !WIDE_ONLY.has(c.field ?? "")).map((c) => ({ sortable: false, resizable: false, suppressMovable: true, cellClass: "!flex items-center", ...c }));
  }, [narrow]);

  return (
    <div ref={wrap} className="claims-grid relative w-full" aria-busy={!ready || undefined}>
      {!ready && <SkeletonGrid rows={rows.length} />}
      {narrow !== null && (
        <div className={ready ? undefined : "invisible absolute inset-x-0 top-0"}>
          <AgGridReact<ClaimRow>
            theme={gridTheme}
            rowData={rows}
            columnDefs={columns}
            context={{ narrow }}
            getRowId={(p) => p.data.id}
            domLayout="autoHeight"
            // The narrow layout stacks the filing time under the claim id: two lines need taller rows.
            rowHeight={narrow ? 56 : 44}
            rowSelection={{ mode: "singleRow", checkboxes: false, enableClickSelection: false }}
            suppressCellFocus={false}
            onGridReady={(e) => {
              api.current = e.api;
            }}
            onFirstDataRendered={() => setReady(true)}
            onRowClicked={(e: RowClickedEvent<ClaimRow>) => e.data && onOpen(e.data.id)}
            onCellKeyDown={(e: CellKeyDownEvent<ClaimRow>) => {
              const key = (e.event as KeyboardEvent | null)?.key;
              if ((key === "Enter" || key === " ") && e.data) {
                e.event?.preventDefault();
                onOpen(e.data.id);
              }
            }}
            rowClass="cursor-pointer"
            overlayNoRowsTemplate="<span></span>"
            animateRows={false}
            suppressDragLeaveHidesColumns
          />
        </div>
      )}
    </div>
  );
}
