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
    // Exhibit E charts the tile's own number by day: the same claims and the same field, so the two always agree. Its
    // axis counts plain seconds; its tooltip reads "0:03".
    timeChart: sent ? "Photo to PayPal, by day" : "Photo check, by day",
    timeExhibit: sent ? "EXHIBIT E · MEDIAN SECONDS · PAYOUTS SENT" : "EXHIBIT E · MEDIAN SECONDS · PHOTO CHECK",
  };
}

type Claim = InsightsData["claims"][number];

/** One cross-filter pick on the page: the field it filters on ("claims.decision") and the values picked; "" when it can't be read as one. */
export interface FilterPick {
  field: string;
  values: string[];
}

/** The page's cross-filter picks, from Studio's page state. A range or multi-value pick (an analyst's chart) has no field. */
export function filterPicks(page: Pick<AgPageState<InsightsRegistry>, "crossFilter"> | undefined): FilterPick[] {
  return Object.values(page?.crossFilter?.values ?? {})
    .flatMap((selections) => selections ?? [])
    .flatMap((s) => (s.type !== "value" ? [{ field: "", values: [] }] : s.values.length ? [{ field: s.field.id, values: s.values.map(String) }] : []));
}

// A bar in Exhibit E picks a calendar day, keyed 20261107; a claim is on the UTC day it was filed, as the console says.
const DAY = "calendar::day";
const dayKey = (iso: string) => iso.slice(0, 10).replaceAll("-", "");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The claims the picks leave on the page, or null when a pick is on a field this can't read (the numbers can't be checked here). */
export function filterClaims<T extends Partial<Claim>>(claims: T[], picks: FilterPick[]): T[] | null {
  const reads = picks.map((p) => {
    if (p.field === DAY) return (c: T) => dayKey(c.filedAt ?? "");
    const key = p.field.match(/^claims\.(\w+)$/)?.[1] as keyof T | undefined;
    return key && ((c: T) => String(c[key]));
  });
  if (reads.some((read) => !read)) return null;
  return claims.filter((c) => picks.every((p, i) => p.values.includes(reads[i]!(c))));
}

// How the filter bar names a pick: a refusal reason reads as itself, a funnel drop by the furthest stage its claims
// reached (the grid's "Furthest stage"), a day as filed.
const or = (values: string[]) => values.join(" or ");
const PICK_LABEL: Record<string, (values: string[]) => string> = {
  "claims.stage": (v) => `Furthest stage: ${or(v)}`,
  "claims.decision": (v) => `Decision: ${or(v)}`,
  [DAY]: (v) => `Filed ${or(v.map((d) => `${Number(d.slice(6))} ${MONTHS[Number(d.slice(4, 6)) - 1] ?? ""}`.trim()))}`,
};

/** "Rejected by a person on review", "Furthest stage: Photos sent · Decision: Held"; a pick this can't name reads as a chart's. */
export function filterLabel(picks: FilterPick[]) {
  return picks.map((p) => (p.field ? (PICK_LABEL[p.field] ?? or)(p.values) : "A pick on a chart")).join(" · ");
}

/**
 * The money and timing tiles' captions for the claims on the page: unfiltered, the captions above; under a cross-filter,
 * the same captions for the picked claims, so "26 of 65 are samples" never sits under a filtered 0. When the picks
 * can't be checked here, the captions only say the tiles are filtered.
 */
export function kpiCaptions(all: Parameters<typeof provenance>[0], shown: Parameters<typeof provenance>[0] | null) {
  const base = captions(provenance(all));
  if (!shown) return { remedied: "Picked claims only", paid: "Picked claims only", time: "Picked claims only" };
  const say = captions(provenance(shown));
  return {
    remedied: say.remedied,
    paid: say.paid,
    // The tile keeps its field: with nothing sent among the picked claims, it has no median to show.
    time: base.timeField !== say.timeField ? "None sent among these claims" : say.time,
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
        format: {
          ...titled(say.timeChart, say.timeExhibit),
          style: { custom: { valueAxis: { title: { enabled: true, text: "Seconds" } } } },
        },
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

/** The homepage's day chart's title, in Studio and in the still that stands in for it (InsightsStill.tsx). */
export const PAID_BY_DAY = "Paid through PayPal, by day";

/** The Refused tile's caption on the homepage: how the refusals split between the photo check and the pre-checks. */
export const refusedSplit = (photo: number, pre: number) => `${photo} rejected by the photo check, ${pre} blocked by pre-checks`;

/** The homepage's refusal reasons card, in 16px rows: its title, the intro line and each reason with its bar. */
export const homeRefusalRows = (reasons: number) => 6 + Math.ceil((reasons * 38) / 16);

/**
 * The homepage's Insights, as Studio state (InsightsPreview.tsx): six widgets on one page. Units remedied and Refused
 * are Studio's own value KPI tiles; the median is Remedy's tile (Studio's can only average); the funnel and the refusal
 * reasons are the console's own widgets; the dollars paid by day are Studio's column chart. `rows` is the canvas height
 * in 16px tracks, measured from the tour's fixed frame, so the page fills it with nothing cut off.
 */
export function homeInsightsReport(data: InsightsData, rows = 40): AgReportState<InsightsRegistry> {
  const say = captions(provenance(data.claims));
  const widgets = overview(data).widgets!;
  const kpiRows = 8;
  const median = widgets["kpi-median"];
  const refused = (gate: string) => data.claims.filter((c) => c.refused && c.refusalGate === gate).length;
  const reasons = new Set(data.claims.flatMap((c) => (c.refusalReason ? [c.refusalReason] : []))).size;
  const body = Math.max(24, rows - kpiRows);
  const refusalRows = Math.min(body - 10, homeRefusalRows(reasons));
  return {
    selectedPageId: "overview",
    pages: [
      {
        id: "overview",
        widgets: {
          "kpi-remedied": kpi("Units remedied", sum("claims.remedied"), `of ${data.recall.unitsSold.toLocaleString("en-US")} sold`),
          "kpi-median": { ...median, format: { title: { enabled: true, text: say.timeTitle }, caption: { enabled: true, text: kpiCaption(data) } } },
          "kpi-refused": kpi("Refused", sum("claims.refused"), refusedSplit(refused("Photo check"), refused("Pre-check"))),
          funnel: { ...widgets.funnel, format: titled("Check funnel") },
          refusals: { ...widgets.refusals, format: titled("Why claims were refused") },
          "paid-by-day": {
            type: "column-chart-grouped",
            dataMapping: { categoryKey: [{ id: "calendar::day" }], valueKey: [sum("claims.amountSent")] },
            format: titled(PAID_BY_DAY),
          },
        } as AgPageState<InsightsRegistry>["widgets"],
        widgetLayout: {
          "kpi-remedied": at(0, 0, 8, kpiRows),
          "kpi-median": at(8, 0, 8, kpiRows),
          "kpi-refused": at(16, 0, 8, kpiRows),
          funnel: at(0, kpiRows, 14, body),
          refusals: at(14, kpiRows, 10, refusalRows),
          "paid-by-day": at(14, kpiRows + refusalRows, 10, body - refusalRows),
        },
      },
    ],
    panels: { filters: { collapsed: true }, edit: { collapsed: true }, data: { collapsed: true }, ai: { collapsed: true } },
  };
}

// "26 payouts": how many claims the median tile's time covers.
const kpiCaption = (data: InsightsData) => {
  const { timeField } = captions(provenance(data.claims));
  const n = data.claims.filter((c) => c[timeField] !== null).length;
  return timeField === "timeToSendSec" ? `across ${n} ${n === 1 ? "payout" : "payouts"}` : `${n} ${n === 1 ? "claim" : "claims"} checked`;
};
