import { duration, formatCents } from "@/app/console/_lib/view";
import { AmountValue, LedgerItem, LedgerStrip } from "@/components/console/Ledger";
import { formatCount } from "@/components/console/format";
import { insightsLedger } from "./report";

type Rows = Parameters<typeof insightsLedger>[0];

/** The report's figures, in the Claims page ledger's type: remedied of sold, paid out, the median time and refusals. */
export function InsightsLedger({ claims, unitsSold, className }: { claims: Rows; unitsSold: number; className?: string }) {
  const l = insightsLedger(claims);
  return (
    <LedgerStrip className={className}>
      <LedgerItem
        className="col-span-2"
        value={
          <>
            {formatCount(l.remedied)}
            <span className="text-ui font-normal text-muted"> of {unitsSold > 0 ? formatCount(unitsSold) : "unknown"}</span>
          </>
        }
        label="remedied"
      />
      <LedgerItem
        className="col-span-2"
        value={<AmountValue cents={l.paidCents} />}
        label="paid through PayPal"
        aside={l.unsentCents > 0 ? `· ${formatCents(l.unsentCents)} approved, not sent` : undefined}
      />
      {l.median !== null && (
        <LedgerItem
          className="col-span-2"
          value={<span className="font-mono">{duration(l.median)}</span>}
          label={`${l.timeLabel} · ${formatCount(l.timed)} ${l.timed === 1 ? l.timedOne : `${l.timedOne}s`}`}
        />
      )}
      <LedgerItem value={formatCount(l.refused)} label="refused" />
    </LedgerStrip>
  );
}
