import clsx from "clsx";
import type { CustomCellRendererProps } from "ag-grid-react";
import type { ComponentType } from "react";
import { isPreCheck, type ClaimRow } from "@/app/console/_lib/view";
import { AmountCell, ChecksCell, ClaimCell, PayerCell, PayoutCell, TimeCell, VerdictCell } from "./cells";
import { verdictOf, type Verdict } from "./VerdictMark";

/*
 * The claims grid's read-only still in plain DOM: the same cells (cells.tsx), columns, widths and theme as ClaimsGrid's
 * `still` mode, without AG Grid's JS. The homepage tour shows it until the real grid has drawn (and to a visitor who
 * lands on the section, until they pick a step), so the swap changes nothing they can see: same columns, same rows,
 * same alignment. Optional columns come and go with the still's width as ClaimsGrid's hiddenAt() decides it (payout
 * from 708px, the photo check's time from 812px, PayPal from 984px), here through container queries.
 */

type Cell = CustomCellRendererProps<ClaimRow>;

interface Column {
  id: string;
  header: string;
  cell: ComponentType<Cell>;
  className: string;
}

const COLUMNS: Column[] = [
  { id: "createdAt", header: "Claim", cell: ClaimCell, className: "w-[220px]" },
  { id: "decision", header: "Verdict", cell: VerdictCell, className: "min-w-[144px] flex-1" },
  { id: "checks", header: "Checks", cell: ChecksCell, className: "w-[136px]" },
  { id: "time", header: "Answered in", cell: TimeCell, className: "hidden w-[104px] justify-end @min-[812px]:flex" },
  // 20px clear of the right-aligned "Answered in" before it, as the grid draws it (claims-grid.css).
  { id: "payer", header: "PayPal", cell: PayerCell, className: "hidden w-[172px] pl-5 @min-[984px]:flex" },
  { id: "payoutStatus", header: "Payout", cell: PayoutCell, className: "hidden w-[112px] @min-[708px]:flex" },
  { id: "amount", header: "Amount", cell: AmountCell, className: "w-[96px] justify-end" },
];

// Phones: the claim and its verdict, the two columns a narrow grid keeps (the verdict's reason under its pill).
const PHONE: Column[] = [
  { id: "createdAt", header: "Claim", cell: ClaimCell, className: "w-[144px]" },
  { id: "decision", header: "Verdict", cell: VerdictCell, className: "min-w-0 flex-1" },
];

// Every row's checks strip as long as the recall's longest, as ClaimsGrid pads it (its `slots`).
function slotsOf(rows: ClaimRow[]) {
  let pre = 0;
  let model = 0;
  for (const r of rows) {
    if (!r.bars) continue;
    pre = Math.max(pre, r.bars.filter((b) => isPreCheck(b.id)).length);
    model = Math.max(model, r.bars.filter((b) => !isPreCheck(b.id)).length);
  }
  return { pre, model };
}

const props = (row: ClaimRow, compact: boolean, slots: { pre: number; model: number }) => ({ data: row, context: { stacked: true, compact, slots } }) as unknown as Cell;

export function GridStill({
  rows,
  openId,
  filter = null,
  phone = false,
  flush = false,
  className,
}: {
  rows: ClaimRow[];
  openId?: string | null;
  /** Only the claims with this decision, as the live grid's status filter shows them. */
  filter?: Verdict | null;
  phone?: boolean;
  /** Flush in a console window (the homepage tour): no border or radius, the window's own ground, the header a quiet
   * label row over a hairline, and the first and last cells on the window's 20px inset (16px on a phone), as the tour
   * draws the live grid (tour.module.css .gate). */
  flush?: boolean;
  className?: string;
}) {
  const columns = phone ? PHONE : COLUMNS;
  const shown = filter ? rows.filter((r) => verdictOf(r) === filter) : rows;
  const slots = slotsOf(rows);
  // Flush, the row's first and last cells sit on the window's inset.
  const edge = flush && (phone ? "first:pl-4 last:pr-4" : "first:pl-5 last:pr-5");
  return (
    <div
      aria-hidden="true"
      className={clsx("claims-grid @container overflow-hidden", flush ? "bg-bg" : "rounded-[10px] border border-line bg-surface", !phone && "h-full", className)}
    >
      {/* 36px and its hairline under it, as AG Grid draws its header (the rows start on the same line). */}
      <div className={clsx("box-content flex h-9 border-b border-line", flush ? "bg-bg" : "bg-surface-2")}>
        {columns.map((c) => (
          <span key={c.id} data-col={c.id} className={clsx("flex shrink-0 items-center px-3 text-[13px] font-medium whitespace-nowrap text-muted", edge, c.className)}>
            {c.header}
          </span>
        ))}
      </div>
      {shown.map((r) => (
        <div
          key={r.id}
          className={clsx(
            // A phone's row grows with a verdict that wraps to two lines, rather than cutting it.
            "relative flex border-b border-line last:border-b-0",
            phone ? "min-h-13 py-1.5" : "h-13",
            // The open claim as the grid draws it (claims-grid.css): a surface step up with an ink edge, never amber.
            r.id === openId && "bg-surface-2 before:absolute before:inset-y-0 before:left-0 before:z-[1] before:w-0.5 before:bg-text-2",
          )}
        >
          {columns.map(({ id, cell: Cell, className: col }) => (
            <span key={id} className={clsx("flex min-w-0 shrink-0 items-center overflow-hidden px-3 text-ui whitespace-nowrap", edge, col)}>
              <span className={clsx("min-w-0 flex-1", (id === "amount" || id === "time") && "flex justify-end")}>
                <Cell {...props(r, phone, slots)} />
              </span>
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
