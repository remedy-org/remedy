import clsx from "clsx";
import type { InsightsData } from "@/app/console/insights/facts";
import { funnel, KIND_LABEL, shownAs } from "./funnel";
import { InsightsLedger } from "./InsightsLedger";

// Below 640px a phone gets the figures and the funnel as plain HTML from the same facts; from 640px the report is AG
// Studio's, its panels stacked below 1024px (InsightsLoader). Server-rendered.

export function MobileSummary({ data }: { data: InsightsData }) {
  const steps = funnel(data.claims);
  const filed = steps[0].reached || 1;

  return (
    <section aria-label="Summary" className="flex flex-col gap-6 px-4 pb-8 sm:hidden">
      <InsightsLedger claims={data.claims} unitsSold={data.recall.unitsSold} />

      <div className="rounded-card border border-line bg-surface p-4">
        <h2 className="text-ui font-medium">Where claims stop</h2>
        <ol className="mt-3 flex flex-col gap-2">
          {steps.map((s, i) => (
            <li key={s.stage} className="flex flex-col gap-1">
              <div className="grid grid-cols-[1fr_2rem] items-center gap-2 text-ui">
                <span>{shownAs(s.stage)}</span>
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
    </section>
  );
}
