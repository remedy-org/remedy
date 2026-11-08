import { durationFigure, LedgerItem, LedgerStrip, MoneyItems } from "@/components/console/Ledger";
import { formatCount } from "@/components/console/format";
import { insightsLedger } from "./report";

type Rows = Parameters<typeof insightsLedger>[0];

/** The report's figures, in the Claims page ledger's type: remedied of sold, approved and sent, the median time and
 * refusals. */
export function InsightsLedger({ claims, unitsSold, className }: { claims: Rows; unitsSold: number; className?: string }) {
  const l = insightsLedger(claims);
  return (
    <LedgerStrip className={className}>
      <LedgerItem
        value={
          <>
            {formatCount(l.remedied)}
            <span className="text-ui font-normal text-muted"> of {unitsSold > 0 ? formatCount(unitsSold) : "unknown"}</span>
          </>
        }
        label="remedied"
      />
      <MoneyItems approvedCents={l.paidCents + l.unsentCents} sentCents={l.paidCents} />
      {l.median !== null && (
        <LedgerItem
          value={durationFigure(l.median)}
          label={`${l.timeLabel} · ${formatCount(l.timed)} ${l.timed === 1 ? l.timedOne : `${l.timedOne}s`}`}
        />
      )}
      <LedgerItem value={formatCount(l.refused)} label="rejected or blocked" />
    </LedgerStrip>
  );
}
