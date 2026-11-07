import type { AgPageState, AgReportState, AgWidgetLayoutState } from "ag-studio";
import type { InsightsData } from "@/app/console/insights/facts";
import type { InsightsRegistry } from "./widgets";

// The Insights report as Studio state: one page on the 24-column canvas (rows of 16px). Field ids refer to the data
// sources in ./sources.ts. Subtitles are exhibit labels, lettered in reading order.

/** A panel's name for the keyboard: its title and exhibit letter ("Decisions, Exhibit B"), or its title alone. */
export function panelName(title: string, subtitle: string) {
  const exhibit = subtitle.match(/^EXHIBIT (\w+)/)?.[1];
  return exhibit ? `${title}, Exhibit ${exhibit}` : title;
}

const at = (xTrack: number, yTrack: number, xSpan: number, ySpan: number): AgWidgetLayoutState => ({ xTrack, yTrack, xSpan, ySpan });
const titled = (text: string, exhibit?: string) => ({
  title: { enabled: true, text },
  ...(exhibit && { subtitle: { enabled: true, text: exhibit } }),
});
const count = { id: "claims.id", aggregation: "countd" as const };
const sum = (id: string) => ({ id, aggregation: "sum" as const });

// Plain value tiles: the claims span a few days, so a day sparkline says little, and its bars ran into the number.
const kpi = (text: string, value: { id: string; aggregation?: "sum" | "countd" }, caption: string) => ({
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

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/**
 * How many paid claims there are, how many of them are samples that never sent money to a real owner, what those
 * samples would have paid, how many sent payouts waited for a person's review, and how many claims the model answered
 * (for the timing tile when nothing was sent).
 */
export function provenance(claims: Pick<InsightsData["claims"][number], "decision" | "source" | "amountPaid" | "modelSec" | "paidOnReview">[]) {
  const paid = claims.filter((c) => c.decision === "Paid");
  const samples = paid.filter((c) => c.source === "Sample");
  return {
    paid: paid.length,
    samples: samples.length,
    sampleAmount: samples.reduce((n, c) => n + c.amountPaid, 0),
    reviewed: paid.filter((c) => c.source !== "Sample" && c.paidOnReview).length,
    answered: claims.filter((c) => c.modelSec !== null).length,
  };
}

/**
 * The captions under the money and timing tiles say where their numbers come from, in the console ledger's words: the
 * money tile counts only what was really sent through PayPal, with the samples' amount beside it as never sent; the
 * timing tile is the ledger's median over payouts really sent (a claim that waited hours for a person would drag an
 * average to minutes), says how many of them waited, and with none sent it shows the model's own answer time instead.
 */
export function captions({ paid, samples, sampleAmount, reviewed, answered }: ReturnType<typeof provenance>) {
  const all = paid > 0 && samples === paid;
  const some = samples > 0 && !all;
  const share = `${samples} of ${paid} are samples`;
  const sent = paid - samples;
  return {
    remedied: all ? "Sample claims · never sent" : some ? `Paid claims · ${share}` : "Paid claims",
    // The tile title already says sandbox; the caption must fit one line of the tile at 1440 (about 200px).
    paid: samples ? `${usd.format(sampleAmount)} sample, never sent` : "Sandbox USD through PayPal",
    timeTitle: sent ? "Median photo to PayPal" : "Median photo check",
    timeField: (sent ? "timeToSendSec" : "modelSec") as "timeToSendSec" | "modelSec",
    time: !sent
      ? `None sent yet · ${answered} ${answered === 1 ? "claim" : "claims"} checked`
      : reviewed
        ? `${sent} sent · ${reviewed} after a person's review`
        : `Median of ${sent} sent ${sent === 1 ? "payout" : "payouts"}`,
    // The chart's axis counts plain seconds; its tooltip reads "0:12".
    timeExhibit: samples ? "EXHIBIT E · MEDIAN SECONDS · SAMPLE TIMINGS" : "EXHIBIT E · MEDIAN SECONDS, PAID CLAIMS",
  };
}

/**
 * Rows (16px each) for the row Exhibits C and D share, tall enough to list every refusal reason with none cut off at the
 * card's foot: a reason takes about 39px, and the 22-row minimum leaves 224px for the list on a 1280px laptop, where
 * the card's intro wraps.
 */
export const refusalRows = (reasons: number) => Math.max(22, 22 + Math.ceil((reasons * 39 - 224) / 16));

const overview = (data: InsightsData): AgPageState<InsightsRegistry> => {
  const say = captions(provenance(data.claims));
  const tall = refusalRows(new Set(data.claims.flatMap((c) => (c.refusalReason ? [c.refusalReason] : []))).size);
  return {
    id: "overview",
    widgets: {
      "kpi-remedied": kpi("Units remedied", sum("claims.remedied"), say.remedied),
      "kpi-paid": kpi("Paid through PayPal (sandbox)", sum("claims.amountSent"), say.paid),
      // Studio's value tile can only average; the ledger's median comes from a widget of Remedy's own.
      "kpi-median": {
        type: "median-time",
        dataMapping: { per: [{ id: "claims.id" }], seconds: [{ id: `claims.${say.timeField}`, aggregation: "max" }] },
        format: { title: { enabled: true, text: say.timeTitle }, caption: { enabled: true, text: say.time } },
      },
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
          valueKey: [{ id: "medianToPaySec" }],
        },
        format: titled("Photo to PayPal, by day", say.timeExhibit),
      },
      claims: {
        type: "grid",
        dataMapping: {
          // Short columns first, so the amount and whether a row is a sample are always in view; the reason runs last.
          cols: [{ id: "claims.id" }, { id: "claims.decision" }, { id: "claims.refund" }, { id: "claims.source" }, { id: "claims.reason" }],
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
      funnel: at(0, 23, 14, tall),
      refusals: at(14, 23, 10, tall),
      // The ledger closes the page across the full width, so a reason reads whole instead of stopping mid-word.
      "time-to-pay": at(0, 23 + tall, 24, 16),
      claims: at(0, 39 + tall, 24, 28),
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
