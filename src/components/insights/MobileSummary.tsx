import clsx from "clsx";
import type { InsightsData } from "@/app/console/insights/facts";
import { Money } from "@/components/ui";
import { funnel } from "./funnel";

// Below 1024px AG Studio's canvas doesn't reflow (it keeps its 24 columns), so phones and small tablets get the
// headline numbers and the funnel as plain HTML from the same facts, then the analyst's chat. Server-rendered.

export function MobileSummary({ data }: { data: InsightsData }) {
  const sum = (k: "remedied" | "refused" | "amountPaid") => data.claims.reduce((n, c) => n + c[k], 0);
  const paidTimes = data.claims.map((c) => c.timeToPaySec).filter((t): t is number => t !== null);
  const avg = paidTimes.length ? Math.round(paidTimes.reduce((a, b) => a + b, 0) / paidTimes.length) : null;
  const steps = funnel(data.claims);
  const filed = steps[0].reached || 1;

  const kpis = [
    { label: "Units remedied", value: <span className="tabular-nums">{sum("remedied")}</span>, note: `of ${data.recall.unitsSold.toLocaleString("en-US")} sold` },
    { label: "Paid out", value: <Money value={sum("amountPaid")} size="inline" />, note: "Sandbox USD" },
    { label: "Avg photo to PayPal", value: <span className="tabular-nums">{avg === null ? "—" : `${avg}s`}</span>, note: "Paid claims" },
    { label: "Refused", value: <span className="tabular-nums">{sum("refused")}</span>, note: "Rejected or blocked" },
  ];

  return (
    <section aria-label="Summary" className="flex flex-col gap-4 px-4 py-5 sm:px-6 lg:hidden">
      <dl className="grid grid-cols-2 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="flex flex-col gap-1 rounded-card border border-line bg-surface p-3">
            <dt className="text-micro text-muted">{k.label}</dt>
            <dd className="text-[1.5rem] leading-tight font-semibold tracking-[-0.02em]">{k.value}</dd>
            <dd className="text-micro text-faint">{k.note}</dd>
          </div>
        ))}
      </dl>

      <div className="rounded-card border border-line bg-surface p-4">
        <h2 className="text-ui font-medium">Check funnel</h2>
        <p className="micro mt-0.5 text-accent-text">Exhibit C · where claims stop</p>
        <ol className="mt-3 flex flex-col gap-2">
          {steps.map((s, i) => (
            <li key={s.stage} className="flex flex-col gap-1">
              <div className="grid grid-cols-[1fr_2rem] items-center gap-2 text-ui">
                <span>{s.stage}</span>
                <span className="text-right font-mono tabular-nums">{s.reached}</span>
              </div>
              <span aria-hidden="true" className="h-2 rounded-[3px] bg-surface-2">
                <span
                  className={clsx("block h-full rounded-[3px]", i === steps.length - 1 ? "bg-pay" : "bg-[color-mix(in_oklch,var(--text)_26%,var(--surface))]")}
                  style={{ width: `${(s.reached / filed) * 100}%` }}
                />
              </span>
              {i < steps.length - 1 && s.stopped > 0 && (
                <p className="text-micro text-muted">
                  <span className="font-mono text-stop">−{s.stopped}</span> {s.topReason}
                  {s.reasons > 1 && <span className="font-mono text-faint"> +{s.reasons - 1} more</span>}
                </p>
              )}
            </li>
          ))}
        </ol>
      </div>

      <p className="text-micro text-muted">The full report is built for a laptop. The analyst below works here too.</p>
    </section>
  );
}
