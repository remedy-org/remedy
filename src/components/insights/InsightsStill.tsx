import clsx from "clsx";
import type { ReactNode } from "react";
import type { InsightsStillData } from "./still";
import { CheckFunnelView } from "./widgets/CheckFunnelView";
import { RefusalReasonsView } from "./widgets/RefusalReasonsView";

// The homepage's Insights step in plain DOM (no Studio JS): three KPI tiles, the console's own check funnel and refusal
// reasons, drawn from the seed (still.ts) by the same view components the console's Studio widgets use. In the tour's
// frame it is a picture; on phones it is the story's third block, read as text.

function Card({ title, children, foot, className }: { title: string; children: ReactNode; foot?: ReactNode; className?: string }) {
  return (
    <div className={clsx("flex min-h-0 flex-col gap-3 rounded-card bg-surface p-4 shadow-card", className)}>
      <p className="text-ui font-medium">{title}</p>
      <div className="min-h-0 flex-1">{children}</div>
      {foot && <p className="border-t border-line pt-3 text-micro text-muted">{foot}</p>}
    </div>
  );
}

function Kpis({ data, className }: { data: InsightsStillData; className?: string }) {
  return (
    <dl className={className}>
      {data.kpis.map((k) => (
        <div key={k.id} data-kpi={k.id} className="flex flex-col justify-between gap-1 rounded-card bg-surface px-4 py-3 shadow-card">
          <dt className="text-ui font-medium">{k.title}</dt>
          <dd className={clsx("text-[28px] leading-none", k.id === "median" && "font-mono")}>{k.value}</dd>
          <dd className="text-micro text-muted">{k.caption}</dd>
        </div>
      ))}
    </dl>
  );
}

export function InsightsStill({
  data,
  rail,
  refusalNote,
  form = "frame",
}: {
  data: InsightsStillData;
  /** The recall analyst's recorded answer, beside the canvas (under it on phones). */
  rail?: ReactNode;
  /** A line under the refusal reasons, in the frame: what a refusal means for the money. */
  refusalNote?: ReactNode;
  form?: "frame" | "phone";
}) {
  if (form === "phone") {
    return (
      <div className="flex flex-col gap-3">
        <Kpis data={data} className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 [&>div:last-child]:min-[360px]:col-span-2" />
        <Card title="Check funnel">
          <CheckFunnelView steps={data.steps} compact />
        </Card>
        <Card title="Why claims were refused">
          <RefusalReasonsView items={data.refusals} compact />
        </Card>
        {rail}
      </div>
    );
  }
  return (
    <div data-still className="flex h-full gap-3 p-4 xl:p-5">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <Kpis data={data} className="grid h-24 shrink-0 grid-cols-3 gap-3" />
        <div className="grid min-h-0 flex-1 grid-cols-[55fr_45fr] gap-3 xl:grid-cols-[14fr_10fr]">
          <Card title="Check funnel">
            <CheckFunnelView steps={data.steps} />
          </Card>
          <Card title="Why claims were refused" foot={refusalNote}>
            <RefusalReasonsView items={data.refusals} />
          </Card>
        </div>
      </div>
      {rail && <div className="w-[280px] shrink-0 xl:w-[320px]">{rail}</div>}
    </div>
  );
}
