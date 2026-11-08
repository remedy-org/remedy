import clsx from "clsx";
import type { ReactNode } from "react";
import { duration, formatCents, type Ledger as LedgerData } from "@/app/console/_lib/view";
import { formatCount } from "./format";

/** One figure: the value (22/500) and what it counts (12, muted). The term comes first in the DOM, as a definition list
 * reads; the value leads on screen. */
export function LedgerItem({ value, label, aside, title, className }: { value: ReactNode; label: ReactNode; aside?: ReactNode; title?: string; className?: string }) {
  return (
    <div className={clsx("flex min-w-0 flex-wrap items-baseline gap-x-2 min-[900px]:flex-nowrap min-[900px]:whitespace-nowrap", className)} title={title}>
      <dt className="order-2 text-micro text-muted">{label}</dt>
      {/* Proportional figures: Schibsted's tabular set spaces the comma and point ("19 , 596"). */}
      <dd className="order-1 text-head-sm leading-7 font-medium">{value}</dd>
      {/* Below 900px the aside takes its own line under the figure, without the dot that joins it on one line. */}
      {aside && (
        <dd className="order-3 text-micro text-muted max-[899px]:basis-full">
          <span aria-hidden="true" className="mr-2 max-[899px]:hidden">
            ·
          </span>
          {aside}
        </dd>
      )}
    </div>
  );
}

/** The figures' strip: hairlines above and below, no boxes. Two columns below 900px, so no figure is left alone on a
 * line; one row above. */
export function LedgerStrip({ className, children }: { className?: string; children: ReactNode }) {
  return <dl className={clsx("grid min-h-12 grid-cols-2 items-start gap-x-6 gap-y-3 border-y border-line py-2.5 min-[900px]:flex min-[900px]:flex-wrap min-[900px]:items-center min-[900px]:gap-x-8", className)}>{children}</dl>;
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
        value={
          <>
            {formatCount(ledger.remedied)}
            <span className="text-ui font-normal text-muted"> of {known ? formatCount(ledger.unitsSold) : "unknown"}</span>
          </>
        }
        label="remedied"
      />
      <LedgerItem
        value={formatCents(ledger.paidCents + ledger.sampleCents)}
        label={`approved · ${formatCount(ledger.remedied)} ${ledger.remedied === 1 ? "refund" : "refunds"}`}
        aside={sentAside(ledger.paidCents, ledger.sampleCents)}
      />
      {ledger.medianToPay !== null && (
        <LedgerItem
          value={durationFigure(ledger.medianToPay)}
          label={`median photo to payout · ${formatCount(ledger.timed)} ${ledger.timed === 1 ? "payout" : "payouts"}`}
        />
      )}
      <LedgerItem value={formatCount(ledger.held)} label="held" className={ledger.held ? undefined : "text-muted"} />
      <LedgerItem value={formatCount(ledger.refused)} label="rejected or blocked" />
    </LedgerStrip>
  );
}

/** Beside what was approved, the quiet second value: what PayPal paid out, or, while nothing was, why: approved
 * refunds whose payees' PayPal accounts can't receive payouts. The Payout column says it per claim. */
/** A time as a figure: the numbers at the figure's size, the units ("min", "s") at the label's, as "of 19,596" is. */
export function durationFigure(sec: number): ReactNode {
  return duration(sec)
    .split(" ")
    .map((t, i) => (
      <span key={i} className={/\d/.test(t) ? undefined : "text-ui font-normal text-muted"}>
        {i > 0 && " "}
        {t}
      </span>
    ));
}

export function sentAside(cents: number, unsent: number): ReactNode {
  if (cents > 0) {
    return (
      <>
        <span className="font-mono">{formatCents(cents)}</span> paid out
      </>
    );
  }
  return unsent > 0 ? <>none paid out: payees can&apos;t receive</> : null;
}
