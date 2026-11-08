import clsx from "clsx";
import type { ReactNode } from "react";
import { duration, formatCents, percent, type Ledger as LedgerData } from "@/app/console/_lib/view";
import { formatCount } from "./format";

function Item({ value, label, className, children }: { value: ReactNode; label: ReactNode; className?: string; children?: ReactNode }) {
  return (
    <div className={clsx("flex min-w-0 flex-wrap items-baseline gap-x-2 sm:flex-nowrap sm:whitespace-nowrap", className)}>
      <dd className="order-1 text-[20px] leading-7 font-semibold">{value}</dd>
      {children}
      <dt className="order-3 text-micro text-muted">{label}</dt>
    </div>
  );
}

/**
 * The 48px ledger strip over the grid: units remedied of units sold with a 64x4 meter, money sent through PayPal, the
 * median time from photos to PayPal, held and refused. With starter claims among the paid, the money figure is what the
 * rule approved, and what was really sent through PayPal sits beside it: starter payouts never leave.
 */
export function Ledger({ ledger, className }: { ledger: LedgerData; className?: string }) {
  const known = ledger.unitsSold > 0;
  const share = known ? ledger.remedied / ledger.unitsSold : 0;
  return (
    <dl className={clsx("grid min-h-12 grid-cols-2 items-center gap-x-6 gap-y-2 border-y border-line py-2.5 sm:flex sm:flex-wrap sm:gap-x-7", className)}>
      <Item
        value={
          <>
            {formatCount(ledger.remedied)}
            <span className="text-ui font-normal text-muted"> of {known ? formatCount(ledger.unitsSold) : "unknown"}</span>
          </>
        }
        label="remedied"
        className="col-span-2"
      >
        {known && (
          <span className="order-2 inline-flex items-center gap-2 self-center" aria-hidden="true">
            <span className="block h-1 w-16 overflow-hidden rounded-full bg-surface-2">
              <span className="block h-full rounded-full bg-pay" style={{ width: `max(2px, ${Math.min(100, share * 100)}%)` }} />
            </span>
            <span className="font-mono text-micro text-faint">{percent(ledger.remedied, ledger.unitsSold)}</span>
          </span>
        )}
      </Item>
      {/* While starter claims are among the paid (their payouts never leave), the figure is what the rule approved, with
          what was really sent beside it; otherwise it is the money sent. */}
      <Item
        className="col-span-2"
        value={<AmountValue cents={ledger.paidCents + ledger.sampleCents} />}
        label={
          ledger.sampleCents > 0 ? (
            <>
              approved
              <span className="text-faint"> · {formatCents(ledger.paidCents)} sent through PayPal</span>
            </>
          ) : (
            "sent through PayPal"
          )
        }
      />
      {ledger.medianToPay !== null && (
        <Item
          className="col-span-2"
          value={<span className="font-mono">{duration(ledger.medianToPay)}</span>}
          label={`median photo → PayPal · ${formatCount(ledger.timed)} ${ledger.timed === 1 ? "payout" : "payouts"}`}
        />
      )}
      <Item value={formatCount(ledger.held)} label="held" className={ledger.held ? undefined : "text-muted"} />
      <Item value={formatCount(ledger.refused)} label="refused" />
    </dl>
  );
}

function AmountValue({ cents }: { cents: number }) {
  const text = formatCents(cents);
  const dot = text.lastIndexOf(".");
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.slice(0, dot)}
        <span className="relative -top-[0.2em] text-[0.73em]">{text.slice(dot)}</span>
      </span>
    </>
  );
}
