import clsx from "clsx";
import type { ReactNode } from "react";
import { InsightsLedger } from "./InsightsLedger";
import { HomeInsights } from "./HomeInsights";
import { MobileSummary } from "./MobileSummary";
import { PaidLines } from "./PaidLines";
import { rowsOf } from "./report";
import type { InsightsStillData } from "./still";
import { CheckFunnelView } from "./widgets/CheckFunnelView";
import { DecisionMixView } from "./widgets/DecisionMixView";
import { RecallProgressView } from "./widgets/RecallProgressView";
import { GATE_LABEL, RefusalReasonsView } from "./widgets/RefusalReasonsView";

// Default: the complete application report in plain DOM, using the same facts and widget views as Studio.
// Marketing opts into the compact HomeInsights view: outcomes and claim progression, with explicit sample scope.

/** A panel as the console's canvas draws it (insights.css): a section under a hairline (none on the first row, which the
 * ledger's closes), the right column 40px off the left one's bars. */
function Panel({ title, children, first, right }: { title: string; children: ReactNode; first?: boolean; right?: boolean }) {
  return (
    <section className={clsx("flex min-h-0 flex-col gap-2.5 pt-[23px] pb-4", !first && "border-t border-line", right && "pl-10")}>
      <h3 className="text-ui font-medium">{title}</h3>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

export function InsightsStill({
  data,
  rail,
  form = "frame",
  credit,
  home = false,
}: {
  data: InsightsStillData;
  /** The recall analyst's recorded answer, beside the canvas (under it on phones). */
  rail?: ReactNode;
  form?: "frame" | "phone";
  /** Phones: the foot under the dashboard naming the SDK it is built on. */
  credit?: string;
  /** A compact explanation for marketing; the full application report remains unchanged. */
  home?: boolean;
}) {
  if (home) return <HomeInsights data={data} rail={rail} phone={form === "phone"} />;
  if (form === "phone") {
    return (
      <div className="overflow-hidden rounded-frame bg-bg shadow-float">
        <div className="flex flex-col gap-6 p-3">
          <MobileSummary data={data.insights} className="flex flex-col gap-6" idPrefix="story" />
          {rail}
        </div>
        {credit && <p className="border-t border-line px-4 py-2.5 text-micro text-muted">{credit}</p>}
      </div>
    );
  }
  const rows = rowsOf(data.insights, false);
  return (
    // The console's page in the frame, on Studio's own rows (16px each, report.ts rowsOf), so the handover moves nothing:
    // a frame shorter than the page scrolls, as the console's page does.
    <div data-still className="flex h-full gap-3 overflow-y-auto p-5">
      <div className="flex min-w-0 flex-1 flex-col">
        <InsightsLedger claims={data.insights.claims} unitsSold={data.insights.recall.unitsSold} />
        <div className="grid shrink-0 grid-cols-[2fr_1fr]" style={{ gridTemplateRows: `${rows.progress * 16}px ${rows.funnel * 16}px` }}>
          <Panel title="Recall progress" first>
            <RecallProgressView {...data.progress} dated />
          </Panel>
          <Panel title="Decisions" first right>
            <DecisionMixView items={data.decisions} />
          </Panel>
          <Panel title="Where claims stop">
            <CheckFunnelView steps={data.steps} />
          </Panel>
          <Panel title="Why claims were refused" right>
            <RefusalReasonsView items={data.refusals} caughtBy={GATE_LABEL} />
          </Panel>
        </div>
        <PaidLines days={data.days} className="" id="tour-paid-lines" />
      </div>
      {rail && <div className="w-[280px] shrink-0 xl:w-[320px]">{rail}</div>}
    </div>
  );
}
