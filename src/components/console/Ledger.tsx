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
      {/* Proportional figures: Schibsted's tabular set spaces the comma and point ("19 , 596"). */}
      <dd className="order-1 text-head-sm leading-7 font-medium">{value}</dd>
      {aside && <dd className="order-3 text-micro text-muted">{aside}</dd>}
    </div>
  );
}

/** The figures' strip: hairlines above and below, no boxes. */
export function LedgerStrip({ className, children }: { className?: string; children: ReactNode }) {
  return <dl className={clsx("grid min-h-12 grid-cols-2 items-center gap-x-6 gap-y-2 border-y border-line py-2.5 sm:flex sm:flex-wrap sm:gap-x-8", className)}>{children}</dl>;
}

/**
 * The ledger over the grid: units remedied of units sold, the refunds approved (with what PayPal sent beside it), the
 * median time from photos to PayPal, held, and rejected or blocked.
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
        value={formatCents(ledger.paidCents + ledger.sampleCents)}
        label={`approved · ${formatCount(ledger.remedied)} ${ledger.remedied === 1 ? "refund" : "refunds"}`}
        aside={<SentAside cents={ledger.paidCents} />}
      />
      {ledger.medianToPay !== null && (
        <LedgerItem
          className="col-span-2"
          value={<span className="font-mono">{duration(ledger.medianToPay)}</span>}
          label={`median photo to payout · ${formatCount(ledger.timed)} ${ledger.timed === 1 ? "payout" : "payouts"}`}
        />
      )}
      <LedgerItem value={formatCount(ledger.held)} label="held" className={ledger.held ? undefined : "text-muted"} />
      <LedgerItem value={formatCount(ledger.refused)} label="rejected or blocked" />
    </LedgerStrip>
  );
}

/** The money PayPal took, beside what was approved: the quiet second value. */
export function SentAside({ cents }: { cents: number }) {
  return (
    <>
      · <span className="font-mono">{formatCents(cents)}</span> sent
    </>
  );
}
