import clsx from "clsx";
import type { CSSProperties, ReactNode } from "react";
import { PAID_BY_DAY } from "./report";
import type { InsightsStillData, PaidDay } from "./still";
import { StillRefusals } from "./StillRefusals";
import { CheckFunnelView } from "./widgets/CheckFunnelView";
import { RefusalReasonsView } from "./widgets/RefusalReasonsView";

// The homepage's Insights step in plain DOM: three KPI tiles, the console's own check funnel and refusal reasons (drawn
// by the same view components the console's Studio widgets use), and the payouts by day, all from the seed (still.ts).
// On laptops it is what the frame shows until AG Studio has drawn the same page, laid out on Studio's own geometry
// (cards on the frame's 20px inset, 12px apart, KPI tiles 116px tall: InsightsPreview.tsx), so the handover moves
// nothing; on phones it is the story's third block, read as text, under the same "Built on AG Studio" foot as the
// queue's "Built on AG Grid".

function Card({ title, children, flat, className }: { title: string; children: ReactNode; flat?: boolean; className?: string }) {
  return (
    <div className={clsx("flex min-h-0 flex-col gap-3 rounded-card p-4", flat ? "ring-1 ring-line" : "bg-surface shadow-card", className)}>
      <p className="text-ui font-medium">{title}</p>
      {children}
    </div>
  );
}

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** Dollars paid through PayPal per day, as Studio's chart draws them: each day's dollars inside its column, in the page's
 * own colour on the green, the day under it, and no column or label for a day nothing was sent. Laptops; a phone (form
 * "phone") keeps the claims paid under each day, read as text. */
function PaidByDay({ days, className, counts = false }: { days: PaidDay[]; className?: string; counts?: boolean }) {
  const max = Math.max(1, ...days.map((d) => d.dollars));
  return (
    <ol className={clsx("grid min-h-0 flex-1 auto-cols-fr grid-flow-col gap-3", className)}>
      {days.map((d, i) => {
        const h = `${(d.dollars / max) * 80}%`;
        return (
          <li key={d.day} className="flex min-h-0 min-w-0 flex-col items-stretch">
            <span className="relative min-h-12 flex-1">
              {d.dollars > 0 && (
                <span data-bar="day" aria-hidden="true" className="absolute inset-x-0 bottom-0 flex justify-center rounded-t-[3px] bg-pay pt-1.5" style={{ height: h, "--i": i } as CSSProperties}>
                  {/* The label waits for its column to finish growing (tour.module.css), so it never floats over nothing. */}
                  <span data-bar-label className="text-micro whitespace-nowrap text-bg">
                    {usd(d.dollars)}
                  </span>
                </span>
              )}
            </span>
            <span className="flex flex-col items-center border-t border-line pt-1.5 text-micro whitespace-nowrap">
              <span className="text-text-2">{d.label}</span>
              {counts && <span className="text-muted">{d.paid} paid</span>}
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
  flat = false,
}: {
  data: InsightsStillData;
  /** The recall analyst's recorded answer, beside the canvas (under it on phones). */
  rail?: ReactNode;
  form?: "frame" | "phone";
  /** Phones: the foot under the dashboard naming the SDK it is built on. */
  credit?: string;
  /**
   * Flat in a console window (the homepage tour): the three figures as a borderless stat strip, as the Claims page's
   * ledger reads, and the panels on the window's ground in a hairline ring, no card surface or shadow. AG Studio is
   * drawn the same way there (home/tour.module.css .studio).
   */
  flat?: boolean;
}) {
  if (form === "phone") {
    // The funnel names every refusal with its count, so a phone skips the separate refusals card.
    return (
      <div className="overflow-hidden rounded-frame bg-bg shadow-float">
        <div className="flex flex-col gap-3 p-3">
          {/* Each figure on one baseline: its label over it (two lines held), its caption under it. Flat, on the
              narrowest phones (under 380px), the three stack, a hairline between them, rather than wrap a word a line. */}
          <dl
            className={clsx(
              "grid grid-cols-3 divide-x divide-line",
              flat ? "max-[379px]:grid-cols-1 max-[379px]:divide-x-0 max-[379px]:divide-y" : "rounded-card bg-surface shadow-card",
            )}
          >
            {data.kpis.map((k) => (
              <div key={k.id} className={clsx("flex min-w-0 flex-col gap-1 py-3", flat ? "px-3 first:pl-1 max-[379px]:px-1" : "px-3")}>
                <dt className={clsx("min-h-[2lh] text-micro leading-tight text-muted", flat && "max-[379px]:min-h-0")}>{k.phone ?? k.title}</dt>
                <dd className="text-[22px] leading-7 whitespace-nowrap">{k.value}</dd>
                <dd className="text-micro leading-tight text-pretty text-muted">{k.caption}</dd>
              </div>
            ))}
          </dl>
          <Card title="Check funnel" flat={flat}>
            <CheckFunnelView steps={data.steps} compact flush />
          </Card>
          <Card title={PAID_BY_DAY} flat={flat}>
            <PaidByDay days={data.days} className="h-36" counts />
          </Card>
          {rail}
        </div>
        {credit && <p className="border-t border-line px-4 py-2.5 text-micro text-muted">{credit}</p>}
      </div>
    );
  }
  return (
    // On a short frame (a 768px-tall screen) the cards keep their height and the canvas scrolls, as Studio's does.
    // Sized, so a frame under 620px (a 1440x900 screen and smaller) can leave out the refusal reasons as Studio does
    // there: the funnel names each one with its count.
    <div data-still className="flex h-full gap-3 overflow-y-auto p-4 [container-type:size] xl:p-5">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <dl className="grid shrink-0 grid-cols-3 gap-3">
          {data.kpis.map((k) => (
            <div key={k.id} data-kpi={k.id} className={clsx("flex flex-col gap-2 xl:h-[116px]", flat ? "py-2" : "rounded-card bg-surface p-4 shadow-card")}>
              <dt className="text-ui font-medium">{k.title}</dt>
              <dd className="text-[28px] leading-none">{k.value}</dd>
              <dd className="text-ui text-pretty text-muted">{k.caption}</dd>
            </div>
          ))}
        </dl>
        <div className="grid flex-1 grid-cols-[55fr_45fr] gap-3 xl:grid-cols-[14fr_10fr]">
          <Card title="Check funnel" flat={flat} className="min-h-auto!">
            {/* The funnel sizes itself to the card (its footer is a size query), so it holds its stages' height here and
                a short frame scrolls instead. */}
            <div className="min-h-60 flex-1">
              <CheckFunnelView steps={data.steps} flush />
            </div>
          </Card>
          <div className="flex flex-col gap-3">
            {/* Shown exactly where Studio shows it at this frame's height (report.ts homeShowsRefusals). */}
            <StillRefusals reasons={data.refusals.length}>
              <Card title="Why claims were refused" flat={flat} className="shrink-0">
                <RefusalReasonsView items={data.refusals} flush />
              </Card>
            </StillRefusals>
            <Card title={PAID_BY_DAY} flat={flat} className="min-h-[144px] flex-1">
              <PaidByDay days={data.days} />
            </Card>
          </div>
        </div>
      </div>
      {rail && <div className="w-[280px] shrink-0 xl:w-[320px]">{rail}</div>}
    </div>
  );
}
