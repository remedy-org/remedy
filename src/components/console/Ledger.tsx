import clsx from "clsx";
import type { ReactNode } from "react";
import { duration, formatCents, noPayout, type Ledger as LedgerData } from "@/app/console/_lib/view";
import { formatCount } from "./format";
import { HoverNote } from "./HoverNote";

/** One figure: the value (22/500) and what it counts (12, muted). The term comes first in the DOM, as a definition list
 * reads; the value leads on screen. */
export function LedgerItem({ value, label, title, className }: { value: ReactNode; label: ReactNode; title?: string; className?: string }) {
  return (
    <div className={clsx("flex min-w-0 items-baseline gap-x-2 whitespace-nowrap", className)} title={title}>
      <dt className="order-2 text-micro text-muted">{label}</dt>
      {/* Proportional figures: Schibsted's tabular set spaces the comma and point ("19 , 596"). */}
      <dd className="order-1 text-head-sm leading-7 font-medium">{value}</dd>
    </div>
  );
}

/** The figures' strip: hairlines above and below, no boxes, one row that wraps only when it must. */
export function LedgerStrip({ className, children }: { className?: string; children: ReactNode }) {
  return <dl className={clsx("flex min-h-12 flex-wrap items-center gap-x-6 gap-y-2 border-y border-line py-2.5 min-[900px]:gap-x-8", className)}>{children}</dl>;
}

/** What PayPal sent leads; refunds approved but never sent (starter claims, which came with the workspace) follow as
 * their own quieter figure, its label a hover card that says why, so approved = sent + not sent is on the strip. */
export function MoneyItems({ sentCents, unsentCents, unsent }: { sentCents: number; unsentCents: number; unsent: number }) {
  return (
    <>
      {/* Nothing sent yet beside approved claims that send nothing (a picture of the shared recall's starter claims):
          the approved figure says it, never a leading $0.00. */}
      {(sentCents > 0 || !unsent) && <LedgerItem value={formatCents(sentCents)} label="sent" />}
      {unsent > 0 && <LedgerItem value={<span className="text-muted">{formatCents(unsentCents)}</span>} label={<HoverNote note={noPayout(unsent)}>approved, not sent</HoverNote>} />}
    </>
  );
}

/**
 * The ledger over the grid: units remedied of units sold, what PayPal sent and what was approved but not sent, and the median time
 * from photos to PayPal once there is one. Held and refused claims are counted on the tabs under it.
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
      <MoneyItems sentCents={ledger.paidCents} unsentCents={ledger.sampleCents} unsent={ledger.sampleRemedied} />
      {ledger.medianToPay !== null && (
        <LedgerItem
          value={durationFigure(ledger.medianToPay)}
          label={`median photo to payout · ${formatCount(ledger.timed)} ${ledger.timed === 1 ? "payout" : "payouts"}`}
        />
      )}
    </LedgerStrip>
  );
}

/** A time as a figure: the numbers at the figure's size, the units ("min", "s") at the label's, as "of 19,596" is. */
export function durationFigure(sec: number): ReactNode {
  return duration(sec)
    .split(" ")
    .map((t, i) => (
      <span key={i} className={/\d/.test(t) ? undefined : "text-ui font-normal text-muted"}>
        {/* A unit after its figure: a narrow no-break space, as the grid and the panel print a span ("3 s"). */}
        {i > 0 && (/\d/.test(t) ? "\u00a0" : "\u202f")}
        {t}
      </span>
    ));
}
