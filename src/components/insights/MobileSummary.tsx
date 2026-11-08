import clsx from "clsx";
import { duration, median } from "@/app/console/_lib/view";
import type { InsightsData } from "@/app/console/insights/facts";
import { Money } from "@/components/ui";
import { funnel, KIND_LABEL } from "./funnel";
import { captions, provenance } from "./report";

// Below 1024px AG Studio's canvas doesn't reflow (it keeps its 24 columns), so phones and small tablets get the
// headline numbers and the funnel as plain HTML from the same facts, then the analyst's chat. Server-rendered.

export function MobileSummary({ data }: { data: InsightsData }) {
  const sum = (k: "remedied" | "refused" | "amountSent" | "amountPaid") => data.claims.reduce((n, c) => n + c[k], 0);
  const say = captions(provenance(data.claims));
  const mid = median(data.claims.map((c) => c[say.timeField]).filter((t): t is number => t !== null));
  const steps = funnel(data.claims);
  const filed = steps[0].reached || 1;

  const kpis = [
    { label: "Units remedied", value: sum("remedied"), note: say.remedied },
    { label: say.paidTitle, value: <Money value={sum(say.paidField)} size="inline" />, note: say.paid },
    { label: say.timeTitle, value: mid === null ? "—" : duration(mid), note: say.time },
    { label: "Refused", value: sum("refused"), note: "Rejected or blocked" },
  ];

  return (
    <section aria-label="Summary" className="flex flex-col gap-4 px-4 py-5 sm:px-6 lg:hidden">
      <dl className="grid grid-cols-2 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="flex flex-col gap-1 rounded-card border border-line bg-surface p-3">
            <dt className="text-micro text-muted">{k.label}</dt>
            <dd className="text-head-sm leading-tight font-medium">{k.value}</dd>
            <dd className="text-micro text-faint">{k.note}</dd>
          </div>
        ))}
      </dl>

      <div className="rounded-card border border-line bg-surface p-4">
        <h2 className="text-ui font-medium">Check funnel</h2>
        <p className="micro mt-0.5 text-faint">Where claims stop</p>
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
              {i < steps.length - 1 &&
                s.groups.map((g) => (
                  <p key={g.kind} className="text-micro text-muted">
                    <span className={clsx("font-mono", g.kind === "refused" ? "text-stop" : g.kind === "held" ? "text-hold" : "text-faint")}>−{g.count}</span>{" "}
                    <span className={g.kind === "refused" ? "text-stop" : g.kind === "held" ? "text-hold" : "text-faint"}>{KIND_LABEL[g.kind]}</span> · {g.summary}
                  </p>
                ))}
            </li>
          ))}
        </ol>
      </div>

      <p className="text-micro text-muted">The full report is built for a laptop. The analyst below works here too.</p>
    </section>
  );
}
