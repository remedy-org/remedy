import clsx from "clsx";
import type { CSSProperties, ReactNode } from "react";
import { PAID_BY_DAY } from "./report";
import type { InsightsStillData, PaidDay } from "./still";
import { CheckFunnelView } from "./widgets/CheckFunnelView";
import { RefusalReasonsView } from "./widgets/RefusalReasonsView";

// The homepage's Insights step in plain DOM: three KPI tiles, the console's own check funnel and refusal reasons (drawn
// by the same view components the console's Studio widgets use), and the payouts by day, all from the seed (still.ts).
// On laptops it is what the frame shows until AG Studio has drawn the same page, laid out on Studio's own geometry
// (cards on the frame's 20px inset, 12px apart, KPI tiles 116px tall: InsightsPreview.tsx), so the handover moves
// nothing; on phones it is the story's third block, read as text, under the same "Built on AG Studio" foot as the
// queue's "Built on AG Grid".

function Card({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={clsx("flex min-h-0 flex-col gap-3 rounded-card bg-surface p-4 shadow-card", className)}>
      <p className="text-ui font-medium">{title}</p>
      {children}
    </div>
  );
}

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** Dollars paid through PayPal per day, as columns: each day's dollars just over its column, the day and the claims paid
 * that day under it. */
function PaidByDay({ days, className }: { days: PaidDay[]; className?: string }) {
  const max = Math.max(1, ...days.map((d) => d.dollars));
  return (
    <ol className={clsx("grid min-h-0 flex-1 auto-cols-fr grid-flow-col gap-3", className)}>
      {days.map((d, i) => {
        const h = `max(3px, ${(d.dollars / max) * 80}%)`;
        return (
          <li key={d.day} className="flex min-h-0 min-w-0 flex-col items-stretch">
            <span className="relative min-h-12 flex-1">
              <span data-bar="day" aria-hidden="true" className="absolute inset-x-0 bottom-0 rounded-t-[3px] bg-pay" style={{ height: h, "--i": i } as CSSProperties} />
              <span className="absolute inset-x-0 text-center text-micro whitespace-nowrap text-text" style={{ bottom: `calc(${h} + 4px)` }}>
                {usd(d.dollars)}
              </span>
            </span>
            <span className="flex flex-col items-center border-t border-line pt-1.5 text-micro whitespace-nowrap">
              <span className="text-text-2">{d.label}</span>
              <span className="text-muted">{d.paid} paid</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function InsightsStill({
  data,
  rail,
  form = "frame",
  credit,
}: {
  data: InsightsStillData;
  /** The recall analyst's recorded answer, beside the canvas (under it on phones). */
  rail?: ReactNode;
  form?: "frame" | "phone";
  /** Phones: the foot under the dashboard naming the SDK it is built on. */
  credit?: string;
}) {
  if (form === "phone") {
    // The funnel names every refusal with its count, so a phone skips the separate refusals card.
    return (
      <div className="overflow-hidden rounded-frame bg-bg shadow-float">
        <div className="flex flex-col gap-3 p-3">
          {/* Each figure on one baseline: its label over it (two lines held), its caption under it. */}
          <dl className="grid grid-cols-3 divide-x divide-line rounded-card bg-surface shadow-card">
            {data.kpis.map((k) => (
              <div key={k.id} className="flex min-w-0 flex-col gap-1 px-3 py-3">
                <dt className="min-h-[2lh] text-micro leading-tight text-muted">{k.phone ?? k.title}</dt>
                <dd className="text-[22px] leading-7">{k.value}</dd>
                <dd className="text-micro leading-tight text-pretty text-muted">{k.caption}</dd>
              </div>
            ))}
          </dl>
          <Card title="Check funnel">
            <CheckFunnelView steps={data.steps} compact flush />
          </Card>
          <Card title={PAID_BY_DAY}>
            <PaidByDay days={data.days} className="h-36" />
          </Card>
          {rail}
        </div>
        {credit && <p className="border-t border-line px-4 py-2.5 text-micro text-muted">{credit}</p>}
      </div>
    );
  }
  return (
    // On a short frame (a 768px-tall screen) the cards keep their height and the canvas scrolls, as Studio's does.
    // Sized, so a short frame (under 540px: a 1280x800 or 1024x768 screen) can leave out the refusal reasons as Studio
    // does there: the funnel names each one with its count.
    <div data-still className="flex h-full gap-3 overflow-y-auto p-4 [container-type:size] xl:p-5">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <dl className="grid shrink-0 grid-cols-3 gap-3">
          {data.kpis.map((k) => (
            <div key={k.id} data-kpi={k.id} className="flex flex-col gap-2 rounded-card bg-surface p-4 shadow-card xl:h-[116px]">
              <dt className="text-ui font-medium">{k.title}</dt>
              <dd className="text-[28px] leading-none">{k.value}</dd>
              <dd className="text-micro text-pretty text-muted">{k.caption}</dd>
            </div>
          ))}
        </dl>
        <div className="grid flex-1 grid-cols-[55fr_45fr] gap-3 xl:grid-cols-[14fr_10fr]">
          <Card title="Check funnel" className="min-h-auto!">
            {/* The funnel sizes itself to the card (its footer is a size query), so it holds its stages' height here and
                a short frame scrolls instead. */}
            <div className="min-h-60 flex-1">
              <CheckFunnelView steps={data.steps} flush />
            </div>
          </Card>
          <div className="flex flex-col gap-3">
            <Card title="Why claims were refused" className="shrink-0 [@container(max-height:540px)]:hidden">
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
