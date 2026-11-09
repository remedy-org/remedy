import type { AgPageState, AgReportState, AgWidgetLayoutState } from "ag-studio";
import { duration } from "@/app/console/_lib/view";
import type { InsightsData } from "@/app/console/insights/facts";
import { median } from "@/app/console/_lib/view";
import { shownAs } from "./funnel";
import type { InsightsRegistry } from "./widgets";

// The Insights report as Studio state: one page on the 24-column canvas (rows of 16px). Field ids refer to the data
// sources in ./sources.ts. The figures above the canvas (InsightsLedger) are Remedy's own, not Studio tiles.

/** A panel's name for the keyboard: its title. */
export const panelName = (title: string) => title;

const at = (xTrack: number, yTrack: number, xSpan: number, ySpan: number): AgWidgetLayoutState => ({ xTrack, yTrack, xSpan, ySpan });
const titled = (text: string) => ({ title: { enabled: true, text } });
const count = { id: "claims.id", aggregation: "countd" as const };
const sum = (id: string) => ({ id, aggregation: "sum" as const });

type LedgerRow = Pick<InsightsData["claims"][number], "remedied" | "refused" | "amountPaid" | "amountSent" | "timeToSendSec" | "modelSec">;

/** The time the page reports: photo to payout once a payout was really sent, the photo check's own time until then. */
export const timeField = (claims: Pick<LedgerRow, "timeToSendSec">[]) =>
  (claims.some((c) => c.timeToSendSec !== null) ? "timeToSendSec" : "modelSec") as "timeToSendSec" | "modelSec";

const cents = (dollars: number) => Math.round(dollars * 100);

/**
 * The figures over the report, in the console ledger's words: units remedied, money paid through PayPal, the median time (photo to payout, or the photo check while nothing was
 * sent: one claim a person approved hours later would drag an average to minutes) and refusals.
 */
export function insightsLedger(claims: LedgerRow[]) {
  const field = timeField(claims);
  const times = claims.map((c) => c[field]).filter((t): t is number => t !== null);
  const paidCents = claims.reduce((n, c) => n + cents(c.amountSent), 0);
  return {
    remedied: claims.reduce((n, c) => n + c.remedied, 0),
    paidCents,
    median: median(times),
    timeLabel: field === "timeToSendSec" ? "median photo to payout sent" : "median photo check",
    timed: times.length,
    timedOne: field === "timeToSendSec" ? "payout" : "claim",
    refused: claims.reduce((n, c) => n + c.refused, 0),
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

// An analyst's chart by day picks a calendar day, keyed 20261107; a claim is on the UTC day it was filed, as the console says.
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

// How the filter bar names a pick, in an operations person's words: a refusal reason reads as itself, a funnel drop
// by where its claims stopped (the furthest stage they passed is the grid's "Furthest stage"), a day as filed.
const or = (values: string[]) => values.map(shownAs).join(" or ");
const STOPPED: Record<string, string> = {
  Filed: "claims still waiting for photos",
  "Photos sent": "claims stopped before the photo check",
  "Passed account checks": "claims stopped at the photo check",
  "Passed photo check": "claims held after passing every check",
  Paid: "approved claims",
};
const PICK_LABEL: Record<string, (values: string[]) => string> = {
  "claims.stage": (v) => v.map((stage) => STOPPED[stage] ?? `claims that passed ${stage}`).join(" or "),
  "claims.decision": (v) => `Verdict: ${or(v)}`,
  [DAY]: (v) => `claims filed ${or(v.map((d) => `${Number(d.slice(6))} ${MONTHS[Number(d.slice(4, 6)) - 1] ?? ""}`.trim()))}`,
};

/** "Rejected by a person on review", "claims stopped before the photo check · Verdict: Held"; a pick this can't name reads as a chart's. */
export function filterLabel(picks: FilterPick[]) {
  return picks.map((p) => (p.field ? (PICK_LABEL[p.field] ?? or)(p.values) : "A pick on a chart")).join(" · ");
}

/**
 * Rows (16px each) for the row the funnel and the refusals share, tall enough to list every refusal reason with none cut off at the
 * panel's foot: a reason takes about 58px (the reason, where it was caught, its bar), and the 22-row minimum leaves
 * 224px for the list on a 1280px laptop.
 */
export const refusalRows = (reasons: number) => Math.max(22, 22 + Math.ceil((reasons * 58 - 224) / 16));

const reasonCount = (data: InsightsData) => new Set(data.claims.flatMap((c) => (c.refusalReason ? [c.refusalReason] : []))).size;

/**
 * Rows for each panel. Side by side the funnel and the refusals share a row (refusalRows); stacked, the decisions and the
 * refusals each take only what they list (the title, then 58px a reason), with no shared height to match.
 */
const rowsOf = (data: InsightsData, narrow: boolean) => {
  const tall = refusalRows(reasonCount(data));
  return narrow
    ? { progress: 15, decisions: 14, funnel: tall, refusals: Math.ceil((72 + reasonCount(data) * 58) / 16), paid: PAID_ROWS }
    : { progress: 15, decisions: 15, funnel: tall, refusals: tall, paid: PAID_ROWS };
};

// The dollars-by-day chart: a row tall enough for its title, the columns and their day labels.
const PAID_ROWS = 15;

/** The canvas rows the report takes: what the page sizes Studio's host to, so the page scrolls and the canvas never does. */
export const reportRows = (data: InsightsData, narrow = false) => {
  const r = rowsOf(data, narrow);
  return narrow ? r.progress + r.decisions + r.funnel + r.refusals + r.paid : r.progress + r.funnel + r.paid;
};

/** The console's day chart: 72px columns, wide enough for a day's dollars inside them ("$1,109.63"). */
export const CONSOLE_CHART = { column: 72 };

/** Studio's own column chart (AG Charts) of the dollars PayPal sent, by the day the claim was filed: each day's sum on
 * its column in the page's background colour (labelColor), the day under it, no value axis. Hovering a column gives the
 * claims remedied that day. The console's Insights and the homepage's draw the same chart. Under a cross-filter the
 * day's whole column dims and what the filter keeps is drawn solid over it; the homepage turns the labels off then
 * (`labels` false), since Studio prints the kept amount at the column's foot, "$0.00" cut in half on the axis. */
export function paidByDayChart(labelColor?: string, labels = true, { column }: { column?: number } = {}) {
  return {
    type: "column-chart-grouped" as const,
    // paidOnDay is empty where nothing was sent, so a day with no payout draws no column and prints no "$0.00".
    dataMapping: { categoryKey: [{ id: "calendar::day" }], valueKey: [sum("claims.paidOnDay")], tooltipKey: [sum("claims.remedied")] },
    format: {
      ...titled(PAID_BY_DAY),
      style: {
        theme: {
          bar: {
            series: {
              // Studio formats the label from the field (a label formatter here is never called).
              label: { enabled: labels, fontSize: 12, ...(labelColor && { color: labelColor }) },
              // The console's full-width chart: each day's column at a fixed width, centred in its day, so a few days
              // never draw as wide slabs across the page.
              ...(column && { width: column }),
            },
          },
        },
        custom: {
          valueAxis: { gridLine: { enabled: false }, line: { width: 0 }, tick: { enabled: false }, label: { fontSize: 1, color: "rgba(0, 0, 0, 0)" } },
          categoryAxis: { tick: { enabled: false }, label: { fontSize: 12 } },
        },
      },
    },
  };
}

// Every claim is one click away in the claims grid (the page header links it), so the report is the figures alone: no
// second table of the same rows. Below 1024px each panel takes the canvas's full width, one under another.
const overview = (data: InsightsData, narrow: boolean, labelColor?: string): AgPageState<InsightsRegistry> => {
  const r = rowsOf(data, narrow);
  return {
    id: "overview",
    widgets: {
      progress: {
        type: "recall-progress",
        dataMapping: {
          remedied: [sum("claims.remedied")],
          sold: [{ id: "recall.unitsSold", aggregation: "max" }],
          days: [{ id: "recall.daysIn", aggregation: "max" }],
        },
        format: titled("Recall progress"),
      },
      decisions: {
        type: "decision-mix",
        dataMapping: { decision: [{ id: "claims.decision" }], count: [count] },
        format: titled("Decisions"),
      },
      funnel: {
        type: "check-funnel",
        dataMapping: {
          stage: [{ id: "claims.stage" }],
          reason: [{ id: "claims.stopReason" }],
          decision: [{ id: "claims.decision" }],
          count: [count],
        },
        format: titled("Where claims stop"),
      },
      refusals: {
        type: "refusal-reasons",
        dataMapping: {
          reason: [{ id: "claims.refusalReason" }],
          gate: [{ id: "claims.refusalGate" }],
          count: [count],
        },
        format: titled("Why claims were refused"),
      },
      "paid-by-day": paidByDayChart(labelColor, true, CONSOLE_CHART),
    } as AgPageState<InsightsRegistry>["widgets"],
    widgetLayout: narrow
      ? {
          progress: at(0, 0, 24, r.progress),
          decisions: at(0, r.progress, 24, r.decisions),
          funnel: at(0, r.progress + r.decisions, 24, r.funnel),
          refusals: at(0, r.progress + r.decisions + r.funnel, 24, r.refusals),
          "paid-by-day": at(0, r.progress + r.decisions + r.funnel + r.refusals, 24, r.paid),
        }
      : {
          progress: at(0, 0, 16, r.progress),
          decisions: at(16, 0, 8, r.decisions),
          funnel: at(0, r.progress, 16, r.funnel),
          refusals: at(16, r.progress, 8, r.refusals),
          // The page's full width, so it ends on one line rather than an empty third beside the chart.
          "paid-by-day": at(0, r.progress + r.funnel, 24, r.paid),
        },
  };
};

export const insightsReport = (data: InsightsData, narrow = false, labelColor?: string): AgReportState<InsightsRegistry> => ({
  selectedPageId: "overview",
  pages: [overview(data, narrow, labelColor)],
  panels: {
    // The analyst opens on demand from "Ask about this recall" in the page header: the report leads, not an empty chat.
    ai: { collapsed: true },
    filters: { collapsed: true },
    edit: { collapsed: true },
    data: { collapsed: true },
  },
});

/** The homepage's median tile: the time it reports (timeField) and its title, in the ledger's words. */
export function homeTime(claims: Pick<LedgerRow, "timeToSendSec">[]) {
  const field = timeField(claims);
  return { timeField: field, timeTitle: field === "timeToSendSec" ? "Median photo to payout" : "Median photo check" };
}

// The homepage's plain value tiles (Studio's own): the claims span a few days, so a day sparkline says little.
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

/** The homepage's day chart's title, in Studio and in the still that stands in for it (InsightsStill.tsx). */
export const PAID_BY_DAY = "Paid through PayPal, by day";

/** The Refused tile's caption on the homepage: where the refusals were stopped, at the photo check or before it, short
 * enough for one line beside the other tiles'. */
export const refusedSplit = (photo: number, pre: number) =>
  [photo ? `${photo} at the photo check` : "", pre ? `${pre} before it` : ""].filter(Boolean).join(", ") || "None refused";

/** The homepage's refusal reasons card, in 16px rows: its padding and title (76px with the gap around the card) and
 * each reason with its bar (34px). */
export const homeRefusalRows = (reasons: number) => Math.ceil((76 + reasons * 34) / 16);

/** The homepage's dollars-by-day chart needs this many 16px rows to read (its card, title and columns, the smallest day's
 * dollars inside its column). The still leaves the refusal reasons out at the same frame height (InsightsStill.tsx). */
export const HOME_DAY_ROWS = 13;

/** The tour's Studio canvas rows for its frame's body height (16px rows under 28px of padding, 24 at least): the tour
 * sizes Studio with it, and the still decides from it what Studio will show, so the handover moves nothing. */
export const homeRowsFor = (bodyHeight: number) => Math.max(24, Math.floor((bodyHeight - 28) / 16));

/** Whether the homepage's Studio lists the refusal reasons at this many rows (homeInsightsReport's rule). */
export const homeShowsRefusals = (rows: number, reasons: number) => Math.max(16, rows - 8) - homeRefusalRows(reasons) >= HOME_DAY_ROWS;

/**
 * The homepage's Insights, as Studio state (InsightsPreview.tsx): six widgets on one page. Units remedied and Refused
 * are Studio's own value KPI tiles; the median is Remedy's tile (Studio's can only average); the funnel and the refusal
 * reasons are the console's own widgets; the dollars paid by day are Studio's column chart. `rows` is the canvas height
 * in 16px tracks, measured from the tour's fixed frame, so the page fills it with nothing cut off. On a short frame (a
 * 1280x800 screen) the refusal reasons give their place to the chart: the funnel already names every reason and count.
 */
export function homeInsightsReport(data: InsightsData, rows = 40, labelColor?: string): AgReportState<InsightsRegistry> {
  const say = homeTime(data.claims);
  const widgets = overview(data, false).widgets!;
  const kpiRows = 8;
  // Studio's value tile can only average; the ledger's median comes from a widget of Remedy's own.
  const median = { type: "median-time" as const, dataMapping: { per: [{ id: "claims.id" }], seconds: [{ id: `claims.${say.timeField}`, aggregation: "max" as const }] } };
  const home = homeKpiCaptions(data.claims);
  const reasons = new Set(data.claims.flatMap((c) => (c.refusalReason ? [c.refusalReason] : []))).size;
  const body = Math.max(16, rows - kpiRows);
  const refusalRows = homeShowsRefusals(rows, reasons) ? homeRefusalRows(reasons) : 0;
  return {
    selectedPageId: "overview",
    pages: [
      {
        id: "overview",
        widgets: {
          "kpi-remedied": kpi("Units remedied", sum("claims.remedied"), `of ${data.recall.unitsSold.toLocaleString("en-US")} sold`),
          "kpi-median": { ...median, format: { title: { enabled: true, text: say.timeTitle }, caption: { enabled: true, text: home.median } } },
          "kpi-refused": kpi("Refused", sum("claims.refused"), home.refused),
          funnel: { ...widgets.funnel, format: titled("Check funnel") },
          ...(refusalRows ? { refusals: { ...widgets.refusals, format: titled("Why claims were refused") } } : {}),
          // Each day's dollars printed on its column (in the page's background colour, which reads on the paid green in
          // both themes), the day under it, no value axis: the still's reading, in Studio, as the console draws it.
          "paid-by-day": paidByDayChart(labelColor),
        } as AgPageState<InsightsRegistry>["widgets"],
        widgetLayout: {
          "kpi-remedied": at(0, 0, 8, kpiRows),
          "kpi-median": at(8, 0, 8, kpiRows),
          "kpi-refused": at(16, 0, 8, kpiRows),
          funnel: at(0, kpiRows, 14, body),
          ...(refusalRows ? { refusals: at(14, kpiRows, 10, refusalRows) } : {}),
          "paid-by-day": at(14, kpiRows + refusalRows, 10, body - refusalRows),
        },
      },
    ],
    panels: { filters: { collapsed: true }, edit: { collapsed: true }, data: { collapsed: true }, ai: { collapsed: true } },
  };
}

/** A time as the homepage says it, in the console's one unit: "12 s" under a minute, else as the ledger prints it
 * ("1 min 5 s"). Never "sec": the console the homepage pictures says "s". */
export const spokenTime = (sec: number) => duration(sec);

type CaptionClaim = Pick<Claim, "decision" | "source" | "amountPaid" | "modelSec" | "paidOnReview" | "timeToSendSec" | "refused" | "refusalGate">;

/**
 * The homepage's median and Refused tiles' captions, for the claims on the page: all of them, or those a cross-filter
 * leaves (`shown`), so a caption never counts claims the tile above it no longer does. The median's field is always the
 * whole recall's, as its tile's is.
 */
export function homeKpiCaptions(all: CaptionClaim[], shown: CaptionClaim[] = all) {
  const field = timeField(all);
  const n = shown.filter((c) => c[field] !== null).length;
  const gate = (g: string) => shown.filter((c) => c.refused && c.refusalGate === g).length;
  const [photo, pre] = [gate("Photo check"), gate("Before the photo check")];
  const filtered = shown !== all;
  return {
    median:
      field === "timeToSendSec"
        ? n || !filtered
          ? `across ${n} ${n === 1 ? "payout" : "payouts"}`
          : "None paid among these claims"
        : `${n} ${n === 1 ? "claim" : "claims"} checked`,
    refused: filtered && !photo && !pre ? "None refused among these claims" : refusedSplit(photo, pre),
  };
}
