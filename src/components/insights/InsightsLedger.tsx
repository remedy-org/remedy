import { duration, formatCents } from "@/app/console/_lib/view";
import { LedgerItem, LedgerStrip, SentAside } from "@/components/console/Ledger";
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
        value={formatCents(l.paidCents + l.unsentCents)}
        label={`approved · ${formatCount(l.remedied)} ${l.remedied === 1 ? "refund" : "refunds"}`}
        aside={<SentAside cents={l.paidCents} />}
      />
      {l.median !== null && (
        <LedgerItem
          className="col-span-2"
          value={<span className="font-mono">{duration(l.median)}</span>}
          label={`${l.timeLabel} · ${formatCount(l.timed)} ${l.timed === 1 ? l.timedOne : `${l.timedOne}s`}`}
        />
      )}
      <LedgerItem value={formatCount(l.refused)} label="rejected or blocked" />
    </LedgerStrip>
  );
}
