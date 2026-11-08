import clsx from "clsx";
import type { CSSProperties, ReactNode } from "react";
import { PAID_BY_DAY } from "./report";
import type { InsightsStillData, PaidDay } from "./still";
import { CheckFunnelView } from "./widgets/CheckFunnelView";
import { RefusalReasonsView } from "./widgets/RefusalReasonsView";

// The homepage's Insights step in plain DOM: three KPI tiles, the console's own check funnel and refusal reasons (drawn
// by the same view components the console's Studio widgets use), and the payouts by day, all from the seed (still.ts).
// On laptops it is what the frame shows until AG Studio has drawn the same page; on phones it is the story's third
// block, read as text.

function Card({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={clsx("flex min-h-0 flex-col gap-3 rounded-card bg-surface p-4 shadow-card", className)}>
      <p className="text-ui font-medium">{title}</p>
      {children}
    </div>
  );
}

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** Dollars paid through PayPal per day, as columns: the day under each, its dollars over it. */
function PaidByDay({ days, stacked, className }: { days: PaidDay[]; stacked?: boolean; className?: string }) {
  const max = Math.max(1, ...days.map((d) => d.dollars));
  return (
    <ol className={clsx("grid min-h-0 flex-1 auto-cols-fr grid-flow-col gap-3", className)}>
      {days.map((d, i) => (
        <li key={d.day} className="flex min-h-0 flex-col items-stretch justify-end gap-1.5">
          <span className="text-micro text-text">{usd(d.dollars)}</span>
          <span className="relative min-h-8 flex-1" aria-hidden="true">
            <span
              data-bar="day"
              className="absolute inset-x-0 bottom-0 rounded-t-[3px] bg-pay"
              style={{ height: `max(3px, ${(d.dollars / max) * 100}%)`, "--i": i } as CSSProperties}
            />
          </span>
          <span className={clsx("flex border-t border-line pt-1.5 text-micro text-muted", stacked ? "flex-col" : "gap-1")}>
            <span className="text-text-2">{d.label}</span>
            {!stacked && "·"} {d.paid} paid
          </span>
        </li>
      ))}
    </ol>
  );
}

export function InsightsStill({
  data,
  rail,
  form = "frame",
}: {
  data: InsightsStillData;
  /** The recall analyst's recorded answer, beside the canvas (under it on phones). */
  rail?: ReactNode;
  form?: "frame" | "phone";
}) {
  if (form === "phone") {
    return (
      <div className="flex flex-col gap-3">
        <dl className="flex flex-col divide-y divide-line rounded-card bg-surface shadow-card">
          {data.kpis.map((k) => (
            <div key={k.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="flex min-w-0 flex-col gap-0.5">
                <span className="text-ui font-medium">{k.title}</span>
                <span className="text-micro text-muted">{k.caption}</span>
              </dt>
              <dd className="shrink-0 text-[24px] leading-none">{k.value}</dd>
            </div>
          ))}
        </dl>
        <Card title="Check funnel">
          <CheckFunnelView steps={data.steps} compact flush />
        </Card>
        <Card title="Why claims were refused">
          <RefusalReasonsView items={data.refusals} compact flush />
        </Card>
        <Card title={PAID_BY_DAY}>
          <PaidByDay days={data.days} stacked className="h-36" />
        </Card>
        {rail}
      </div>
    );
  }
  return (
    // On a short frame (a 768px-tall screen) the cards keep their height and the canvas scrolls, as Studio's does.
    <div data-still className="flex h-full gap-3 overflow-y-auto p-4 xl:p-5">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <dl className="grid shrink-0 grid-cols-3 gap-3">
          {data.kpis.map((k) => (
            <div key={k.id} data-kpi={k.id} className="flex flex-col gap-2 rounded-card bg-surface px-4 py-3 shadow-card">
              <dt className="text-ui font-medium">{k.title}</dt>
              <dd className="text-[28px] leading-none">{k.value}</dd>
              <dd className="text-micro text-muted">{k.caption}</dd>
            </div>
          ))}
        </dl>
        <div className="grid flex-1 grid-cols-[55fr_45fr] gap-3 xl:grid-cols-[14fr_10fr]">
          <Card title="Check funnel">
            <div className="min-h-0 flex-1">
              <CheckFunnelView steps={data.steps} flush />
            </div>
          </Card>
          <div className="flex flex-col gap-3">
            <Card title="Why claims were refused" className="shrink-0">
              <RefusalReasonsView items={data.refusals} flush />
            </Card>
            <Card title={PAID_BY_DAY} className="min-h-[144px] flex-1">
              <PaidByDay days={data.days} />
            </Card>
          </div>
        </div>
      </div>
      {rail && <div className="w-[280px] shrink-0 xl:w-[320px]">{rail}</div>}
    </div>
  );
}
