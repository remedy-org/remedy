import clsx from "clsx";
import type { ReactNode } from "react";
import { duration, formatCents, type Ledger as LedgerData } from "@/app/console/_lib/view";
import { formatCount } from "./format";

/** One figure: the value (22/500) and what it counts (12, muted). The term comes first in the DOM, as a definition list
 * reads; the value leads on screen. */
export function LedgerItem({ value, label, title, className }: { value: ReactNode; label: ReactNode; title?: string; className?: string }) {
  return (
    <div className={clsx("flex min-w-0 items-baseline gap-x-2 whitespace-nowrap", className)} title={title}>
      <dt className="order-2 text-micro text-muted">{label}</dt>
      <dd className="order-1 text-head-sm leading-7 font-medium">{value}</dd>
    </div>
  );
}

/** The figures' strip: hairlines above and below, no boxes, one row that wraps only when it must. */
export function LedgerStrip({ className, children }: { className?: string; children: ReactNode }) {
  return <dl className={clsx("flex min-h-12 flex-wrap items-center gap-x-6 gap-y-2 border-y border-line py-2.5 min-[900px]:gap-x-8", className)}>{children}</dl>;
}

/**
 * A figure whose digits keep one width as it changes ($779.74 to $809.73), so the words beside it never shift, while its
 * comma and point keep their own: Schibsted's tabular set spaces those ("19 , 596"), so only the digit runs are tabular.
 */
export function Figure({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\d+)/).map((part, i) =>
        /\d/.test(part) ? (
          <span key={i} className="tabular-nums">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** What PayPal sent: the one money figure, in the words the tour and the report use. */
export function MoneyItems({ sentCents }: { sentCents: number }) {
  return <LedgerItem value={<Figure text={formatCents(sentCents)} />} label="paid through PayPal" />;
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
            <Figure text={formatCount(ledger.remedied)} />
            <span className="text-ui font-normal text-muted"> of {known ? formatCount(ledger.unitsSold) : "unknown"}</span>
          </>
        }
        label="remedied"
      />
      <MoneyItems sentCents={ledger.paidCents} />
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
      <span key={i} className={/\d/.test(t) ? "tabular-nums" : "text-ui font-normal text-muted"}>
        {/* A unit after its figure: a narrow no-break space, as the grid and the panel print a span ("3 s"). */}
        {i > 0 && (/\d/.test(t) ? "\u00a0" : "\u202f")}
        {t}
      </span>
    ));
}
