import type { AgPageState, AgReportState, AgWidgetLayoutState } from "ag-studio";
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
    style: { verticalAlign: "top" as const, textAlign: "left" as const, textScaling: { enabled: false } },
  },
});

const overview: AgPageState<InsightsRegistry> = {
  id: "overview",
  widgets: {
    "kpi-remedied": kpi("Units remedied", sum("claims.remedied"), "Paid claims"),
    "kpi-paid": kpi("Paid out", sum("claims.amountPaid"), "Sandbox USD through PayPal"),
    "kpi-median": kpi("Avg photo to PayPal", { id: "claims.timeToPaySec", aggregation: "avg" }, "Paid claims, seconds"),
    "kpi-refused": kpi("Refused", sum("claims.refused"), "Rejected or blocked"),
    progress: {
      type: "recall-progress",
      dataMapping: { remedied: [sum("claims.remedied")], sold: [{ id: "recall.unitsSold", aggregation: "max" }] },
      format: titled("Recall progress", "EXHIBIT A · REMEDIED AGAINST SOLD"),
    },
    decisions: {
      type: "decision-mix",
      dataMapping: { decision: [{ id: "claims.decision" }], count: [count] },
      format: titled("Decisions", "EXHIBIT B · DECIDED BY THE RULE"),
    },
    funnel: {
      type: "check-funnel",
      dataMapping: { stage: [{ id: "claims.stage" }], reason: [{ id: "claims.stopReason" }], count: [count] },
      format: titled("Check funnel", "EXHIBIT C · WHERE CLAIMS STOP"),
    },
    refusals: {
      type: "refusal-reasons",
      dataMapping: { reason: [{ id: "claims.refusalReason" }], gate: [{ id: "claims.refusalGate" }], count: [count] },
      format: titled("Why claims were refused", "EXHIBIT D · REFUSALS BY REASON"),
    },
    "time-to-pay": {
      type: "column-chart-grouped",
      dataMapping: { categoryKey: [{ id: "calendar::day" }], valueKey: [{ id: "claims.timeToPaySec", aggregation: "avg" }] },
      format: titled("Photo to PayPal, by day", "EXHIBIT E · AVERAGE SECONDS, PAID CLAIMS"),
    },
    claims: {
      type: "grid",
      dataMapping: {
        cols: [
          { id: "claims.id" },
          { id: "claims.filedAt" },
          { id: "claims.decision" },
          { id: "claims.reason" },
          { id: "claims.source" },
          sum("claims.amountPaid"),
          sum("claims.timeToPaySec"),
        ],
      },
      sort: [{ field: { id: "claims.filedAt" }, direction: "desc" }],
      format: titled("Every claim", "EXHIBIT F · NEWEST FIRST"),
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

export const insightsReport: AgReportState<InsightsRegistry> = {
  selectedPageId: overview.id,
  pages: [overview],
  panels: {
    ai: { collapsed: false },
    filters: { collapsed: true },
    edit: { collapsed: true },
    data: { collapsed: true },
  },
};
