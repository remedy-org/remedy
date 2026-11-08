import clsx from "clsx";
import type { CustomCellRendererProps } from "ag-grid-react";
import type { ComponentType } from "react";
import type { ClaimRow } from "@/app/console/_lib/view";
import { AmountCell, ChecksCell, ClaimCell, PayerCell, PayoutCell, TimelineCell, VerdictCell } from "./cells";

/*
 * The claims grid's read-only still in plain DOM: the same cells (cells.tsx), columns, widths and theme as ClaimsGrid's
 * `still` mode, without AG Grid's JS. The homepage tour shows it until the real grid has drawn (and to a visitor who
 * lands on the section, until they pick a step), so the swap changes nothing they can see: same columns, same rows,
 * same alignment. Optional columns come and go with the still's width as ClaimsGrid's hiddenAt() decides it (payout
 * from 704px, timeline from 872px, PayPal from 1004px), here through container queries.
 */

type Cell = CustomCellRendererProps<ClaimRow>;

interface Column {
  id: string;
  header: string;
  cell: ComponentType<Cell>;
  className: string;
}

const COLUMNS: Column[] = [
  { id: "createdAt", header: "Claim · UTC", cell: ClaimCell, className: "w-[220px]" },
  { id: "decision", header: "Verdict", cell: VerdictCell, className: "min-w-[144px] flex-1" },
  { id: "checks", header: "Checks", cell: ChecksCell, className: "w-[132px]" },
  { id: "timeline", header: "Timeline", cell: TimelineCell, className: "hidden w-[168px] @min-[872px]:flex" },
  { id: "payer", header: "PayPal", cell: PayerCell, className: "hidden w-[132px] @min-[1004px]:flex" },
  { id: "payoutStatus", header: "Payout", cell: PayoutCell, className: "hidden w-[112px] @min-[704px]:flex" },
  { id: "amount", header: "Amount", cell: AmountCell, className: "w-[96px] justify-end" },
];

const props = (row: ClaimRow) => ({ data: row, context: { stacked: true } }) as unknown as Cell;

export function GridStill({ rows, openId, className }: { rows: ClaimRow[]; openId?: string | null; className?: string }) {
  return (
    <div aria-hidden="true" className={clsx("claims-grid @container h-full overflow-hidden rounded-[10px] border border-line bg-surface", className)}>
      <div className="flex h-9 border-b border-line bg-surface-2">
        {COLUMNS.map((c) => (
          <span key={c.id} className={clsx("flex shrink-0 items-center px-3 font-mono text-micro font-medium tracking-[0.06em] text-faint uppercase", c.className)}>
            {c.header}
          </span>
        ))}
      </div>
      {rows.map((r) => (
        <div
          key={r.id}
          className={clsx(
            "relative flex h-13 border-b border-line",
            r.id === openId && "bg-accent-soft before:absolute before:inset-y-0 before:left-0 before:z-[1] before:w-0.5 before:bg-accent",
          )}
        >
          {COLUMNS.map(({ id, cell: Cell, className: col }) => (
            <span key={id} className={clsx("flex min-w-0 shrink-0 items-center overflow-hidden px-3 text-ui whitespace-nowrap", col)}>
              <span className={clsx("min-w-0 flex-1", id === "amount" && "flex justify-end")}>
                <Cell {...props(r)} />
              </span>
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
