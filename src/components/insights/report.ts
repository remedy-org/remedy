import type { AgPageState, AgReportState, AgWidgetLayoutState } from "ag-studio";
import type { InsightsData } from "@/app/console/insights/facts";
import type { InsightsRegistry } from "./widgets";

// The Insights report as Studio state: one page on the 24-column canvas (rows of 16px). Field ids refer to the data
// sources in ./sources.ts. Subtitles are exhibit labels, lettered in reading order.

const at = (xTrack: number, yTrack: number, xSpan: number, ySpan: number): AgWidgetLayoutState => ({ xTrack, yTrack, xSpan, ySpan });
const titled = (text: string, exhibit?: string) => ({
  title: { enabled: true, text },
  ...(exhibit && { subtitle: { enabled: true, text: exhibit } }),
});
const count = { id: "claims.id", aggregation: "countd" as const };
const sum = (id: string) => ({ id, aggregation: "sum" as const });

// Plain value tiles: the claims span a few days, so a day sparkline says little, and its bars ran into the number.
const kpi = (text: string, value: { id: string; aggregation?: "sum" | "avg" | "countd" }, caption: string) => ({
  type: "value" as const,
  dataMapping: { value: [value] },
  format: {
    title: { enabled: true, text },
    caption: { enabled: true, text: caption },
    style: {
      verticalAlign: "top" as const,
      textAlign: "left" as const,
      textScaling: { enabled: false },
    },
  },
});

/** How many paid claims there are, and how many of them are samples that never sent money to a real owner. */
export function provenance(claims: Pick<InsightsData["claims"][number], "decision" | "source">[]) {
  const paid = claims.filter((c) => c.decision === "Paid");
  return {
    paid: paid.length,
    samples: paid.filter((c) => c.source === "Sample").length,
  };
}

/**
 * The captions under the money and timing tiles say where their numbers come from: sample claims were decided "paid"
 * by the rule, but no payout ever reached a real owner, so their amounts and timings are samples too.
 */
export function captions({ paid, samples }: ReturnType<typeof provenance>) {
  const all = paid > 0 && samples === paid;
  const some = samples > 0 && !all;
  const share = `${samples} of ${paid} are samples`;
  return {
    remedied: all ? "Sample claims · never sent" : some ? `Paid claims · ${share}` : "Paid claims",
    paid: all ? "Sample claims · never sent" : some ? `Sandbox USD · ${share}` : "Sandbox USD through PayPal",
    time: all ? `Average of ${paid} · sample timings` : some ? `Average of ${paid} · ${share}` : `Average of ${paid} paid ${paid === 1 ? "claim" : "claims"}`,
    timeExhibit: samples ? "EXHIBIT E · AVERAGE SECONDS · SAMPLE TIMINGS" : "EXHIBIT E · AVERAGE SECONDS, PAID CLAIMS",
  };
}

const overview = (data: InsightsData): AgPageState<InsightsRegistry> => {
  const say = captions(provenance(data.claims));
  return {
    id: "overview",
    widgets: {
      "kpi-remedied": kpi("Units remedied", sum("claims.remedied"), say.remedied),
      "kpi-paid": kpi("Paid out", sum("claims.amountPaid"), say.paid),
      "kpi-median": kpi("Avg photo to PayPal", { id: "claims.timeToPaySec", aggregation: "avg" }, say.time),
      "kpi-refused": kpi("Refused", sum("claims.refused"), "Rejected or blocked"),
      progress: {
        type: "recall-progress",
        dataMapping: {
          remedied: [sum("claims.remedied")],
          sold: [{ id: "recall.unitsSold", aggregation: "max" }],
          samples: [sum("claims.remediedSample")],
        },
        format: titled("Recall progress", "EXHIBIT A · REMEDIED AGAINST SOLD"),
      },
      decisions: {
        type: "decision-mix",
        dataMapping: { decision: [{ id: "claims.decision" }], count: [count] },
        format: titled("Decisions", "EXHIBIT B · DECIDED BY THE RULE"),
      },
      funnel: {
        type: "check-funnel",
        dataMapping: {
          stage: [{ id: "claims.stage" }],
          reason: [{ id: "claims.stopReason" }],
          decision: [{ id: "claims.decision" }],
          count: [count],
        },
        format: titled("Check funnel", "EXHIBIT C · WHERE CLAIMS STOP"),
      },
      refusals: {
        type: "refusal-reasons",
        dataMapping: {
          reason: [{ id: "claims.refusalReason" }],
          gate: [{ id: "claims.refusalGate" }],
          count: [count],
        },
        format: titled("Why claims were refused", "EXHIBIT D · REFUSALS BY REASON"),
      },
      "time-to-pay": {
        type: "column-chart-grouped",
        dataMapping: {
          categoryKey: [{ id: "calendar::day" }],
          valueKey: [{ id: "claims.timeToPaySec", aggregation: "avg" }],
        },
        format: titled("Photo to PayPal, by day", say.timeExhibit),
      },
      claims: {
        type: "grid",
        dataMapping: {
          // Short columns first, so the amount and whether a row is a sample are always in view; the reason runs last.
          cols: [{ id: "claims.id" }, { id: "claims.decision" }, sum("claims.amountPaid"), { id: "claims.source" }, { id: "claims.reason" }],
        },
        sort: [{ field: { id: "claims.filedAt" }, direction: "desc" }],
        // No grand total: a sum under a column of decisions and reasons says nothing.
        format: { ...titled("Every claim", "EXHIBIT F · NEWEST FIRST"), style: { grandTotalRow: { enabled: false } } },
      },
    },
    widgetLayout: {
      "kpi-remedied": at(0, 0, 6, 8),
      "kpi-paid": at(6, 0, 6, 8),
      "kpi-median": at(12, 0, 6, 8),
      "kpi-refused": at(18, 0, 6, 8),
      progress: at(0, 8, 16, 15),
      decisions: at(16, 8, 8, 15),
      funnel: at(0, 23, 14, 22),
      refusals: at(14, 23, 10, 22),
      "time-to-pay": at(0, 45, 10, 20),
      claims: at(10, 45, 14, 20),
    },
  };
};

export const insightsReport = (data: InsightsData): AgReportState<InsightsRegistry> => ({
  selectedPageId: "overview",
  pages: [overview(data)],
  panels: {
    ai: { collapsed: false },
    filters: { collapsed: true },
    edit: { collapsed: true },
    data: { collapsed: true },
  },
});
