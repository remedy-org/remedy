import clsx from "clsx";
import type { ReactNode } from "react";
import { duration, formatCents, type Ledger as LedgerData } from "@/app/console/_lib/view";
import { formatCount } from "./format";

/** One figure: the value (22/500) and what it counts (12, muted). The term comes first in the DOM, as a definition list
 * reads; the value leads on screen. */
export function LedgerItem({ value, label, aside, title, className }: { value: ReactNode; label: ReactNode; aside?: ReactNode; title?: string; className?: string }) {
  return (
    <div className={clsx("flex min-w-0 flex-wrap items-baseline gap-x-2 sm:flex-nowrap sm:whitespace-nowrap", className)} title={title}>
      <dt className="order-2 text-micro text-muted">{label}</dt>
      <dd className="order-1 text-head-sm leading-7 font-medium tabular-nums">{value}</dd>
      {aside && <dd className="order-3 text-micro text-muted">{aside}</dd>}
    </div>
  );
}

/** The figures' strip: hairlines above and below, no boxes. */
export function LedgerStrip({ className, children }: { className?: string; children: ReactNode }) {
  return <dl className={clsx("grid min-h-12 grid-cols-2 items-center gap-x-6 gap-y-2 border-y border-line py-2.5 sm:flex sm:flex-wrap sm:gap-x-8", className)}>{children}</dl>;
}

/**
 * The ledger over the grid: units remedied of units sold, money paid out through PayPal (with what was approved and
 * not sent beside it), the median time from photos to PayPal, held and refused.
 */
export function Ledger({ ledger, className }: { ledger: LedgerData; className?: string }) {
  const known = ledger.unitsSold > 0;
  return (
    <LedgerStrip className={className}>
      <LedgerItem
        className="col-span-2"
        value={
          <>
            {formatCount(ledger.remedied)}
            <span className="text-ui font-normal text-muted"> of {known ? formatCount(ledger.unitsSold) : "unknown"}</span>
          </>
        }
        label="remedied"
      />
      <LedgerItem
        className="col-span-2"
        value={<AmountValue cents={ledger.paidCents} />}
        label="paid out"
        aside={ledger.sampleCents > 0 ? `· ${formatCents(ledger.sampleCents)} approved, not sent` : undefined}
      />
      {ledger.medianToPay !== null && (
        <LedgerItem
          className="col-span-2"
          value={<span className="font-mono">{duration(ledger.medianToPay)}</span>}
          label={`median photo to payout · ${formatCount(ledger.timed)} ${ledger.timed === 1 ? "payout" : "payouts"}`}
        />
      )}
      <LedgerItem value={formatCount(ledger.held)} label="held" className={ledger.held ? undefined : "text-muted"} />
      <LedgerItem value={formatCount(ledger.refused)} label="refused" />
    </LedgerStrip>
  );
}

export function AmountValue({ cents }: { cents: number }) {
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
