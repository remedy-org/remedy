import clsx from "clsx";
import type { InsightsData } from "@/app/console/insights/facts";
import { funnel, KIND_LABEL, shownAs } from "./funnel";
import { InsightsLedger } from "./InsightsLedger";
import { PaidLines } from "./PaidLines";
import { paidDays } from "./report";

// Below 640px a phone gets the figures, the funnel and the day lines as plain HTML from the same facts; from 640px the report is AG
// Studio's, its panels stacked below 1024px (InsightsLoader). Server-rendered. The homepage's phone story draws the same
// summary in its frame (InsightsStill), with its own `className` for the frame's place of the page's.

export function MobileSummary({ data, className = "page flex flex-col gap-6 pb-8 sm:hidden", idPrefix = "summary" }: { data: InsightsData; className?: string; idPrefix?: string }) {
  const steps = funnel(data.claims);
  const filed = steps[0].reached || 1;

  return (
    <section aria-label="Summary" className={className}>
      <InsightsLedger claims={data.claims} unitsSold={data.recall.unitsSold} />

      <div>
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
                  className={clsx("block h-full rounded-[3px]", i === steps.length - 1 ? "bg-pay-fill" : "bg-[color-mix(in_oklch,var(--text)_26%,var(--surface))]")}
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
      <PaidLines days={paidDays(data.claims)} className="" id={`${idPrefix}-paid-lines`} />
    </section>
  );
}
