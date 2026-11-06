import type { ReactNode } from "react";
import { Meter } from "@/components/ui";
import { formatCents, percent, type Stats } from "@/app/console/_lib/view";
import { formatCount, plural } from "./format";

function Stat({ label, value, children }: { label: string; value: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 px-4 py-4 sm:px-6 sm:py-5">
      <dt className="text-ui text-muted">{label}</dt>
      <dd className="text-h2 font-semibold tabular-nums">{value}</dd>
      {children && <dd className="text-ui text-muted">{children}</dd>}
    </div>
  );
}

/** The four numbers a recall is judged by: units remedied of sold, money paid out, waiting for a person, refused. */
export function StatsBand({ stats }: { stats: Stats }) {
  const known = stats.unitsSold > 0;
  return (
    <dl className="grid grid-cols-2 rounded-card border border-line bg-surface lg:grid-cols-4 [&>div]:border-line max-lg:[&>div:nth-child(-n+2)]:border-b max-lg:[&>div:nth-child(odd)]:border-r lg:[&>div:not(:last-child)]:border-r">
      <Stat
        label="Units remedied"
        value={
          <>
            {formatCount(stats.remedied)}
            <span className="text-ui font-normal text-muted"> of {known ? formatCount(stats.unitsSold) : "unknown"}</span>
          </>
        }
      >
        {known ? (
          <Meter value={stats.remedied} max={stats.unitsSold} label="Units remedied of units sold" valueText={percent(stats.remedied, stats.unitsSold)} className="mt-1" />
        ) : (
          "CPSC gave no unit count"
        )}
      </Stat>
      <Stat label="Paid out" value={formatCents(stats.paidCents)}>
        {stats.settling ? `${plural(stats.remedied, "payout")}, ${formatCount(stats.settling)} settling` : plural(stats.remedied, "payout")}
      </Stat>
      <Stat label="Waiting for review" value={formatCount(stats.held)}>
        {stats.pending ? `Held for a person; ${formatCount(stats.pending)} still checking` : "Held for a person"}
      </Stat>
      <Stat label="Refused" value={formatCount(stats.rejected + stats.blocked)}>
        {formatCount(stats.rejected)} rejected, {formatCount(stats.blocked)} blocked
      </Stat>
    </dl>
  );
}
