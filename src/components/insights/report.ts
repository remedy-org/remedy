import type { AgPageState, AgReportState, AgWidgetLayoutState } from "ag-studio";
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
  "Passed checks before the photo check": "claims stopped at the photo check",
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
export const rowsOf = (data: InsightsData, narrow: boolean) => {
  const tall = refusalRows(reasonCount(data));
  return narrow
    ? { progress: 15, decisions: 14, funnel: tall, refusals: Math.ceil((72 + reasonCount(data) * 58) / 16), paid: PAID_ROWS }
    : { progress: 15, decisions: 15, funnel: tall, refusals: tall, paid: PAID_ROWS };
};

// The dollars-by-day chart: a row tall enough for its title, the columns and their day labels.
const PAID_ROWS = 15;

const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** The UTC days PayPal paid on, as the day chart groups them (the day each paid claim was filed), oldest first: "8 Nov",
 * its dollars and its payouts. */
export function paidDays(claims: Pick<InsightsData["claims"][number], "filedAt" | "paidOnDay">[]) {
  const days = new Map<string, { day: string; dollars: number; payouts: number }>();
  for (const c of [...claims].sort((a, b) => a.filedAt.localeCompare(b.filedAt))) {
    if (c.paidOnDay === null) continue;
    const key = c.filedAt.slice(0, 10);
    const d = days.get(key) ?? { day: dayFmt.format(new Date(c.filedAt)), dollars: 0, payouts: 0 };
    days.set(key, { ...d, dollars: d.dollars + c.paidOnDay, payouts: d.payouts + 1 });
  }
  return [...days.values()];
}

/** The day chart needs three days of payouts to read as a chart; fewer draw as plain lines under the report
 * (InsightsStudio), never one green column alone across the page. */
export const chartsPaidByDay = (data: InsightsData) => paidDays(data.claims).length >= 3;

/** The canvas rows the report takes: what the page sizes Studio's host to, so the page scrolls and the canvas never does. */
export const reportRows = (data: InsightsData, narrow = false) => {
  const r = rowsOf(data, narrow);
  const paid = chartsPaidByDay(data) ? r.paid : 0;
  return narrow ? r.progress + r.decisions + r.funnel + r.refusals + paid : r.progress + r.funnel + paid;
};

/** The console's day chart: 72px columns, wide enough for a day's dollars inside them ("$1,109.63"). */
export const CONSOLE_CHART = { column: 72 };

/** Studio's own column chart (AG Charts) of the dollars PayPal sent, by the day the claim was filed: each day's sum on
 * its column in the page's background colour (labelColor), the day under it, no value axis. Hovering a column gives the
 * claims remedied that day. The console's Insights draws it (and so the homepage's) once payouts span three days. Under a
 * cross-filter the day's whole column dims and what the filter keeps is drawn solid over it; the labels go then
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
  const chart = chartsPaidByDay(data);
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
      ...(chart && { "paid-by-day": paidByDayChart(labelColor, true, CONSOLE_CHART) }),
    } as AgPageState<InsightsRegistry>["widgets"],
    widgetLayout: narrow
      ? {
          progress: at(0, 0, 24, r.progress),
          decisions: at(0, r.progress, 24, r.decisions),
          funnel: at(0, r.progress + r.decisions, 24, r.funnel),
          refusals: at(0, r.progress + r.decisions + r.funnel, 24, r.refusals),
          ...(chart && { "paid-by-day": at(0, r.progress + r.decisions + r.funnel + r.refusals, 24, r.paid) }),
        }
      : {
          progress: at(0, 0, 16, r.progress),
          decisions: at(16, 0, 8, r.decisions),
          funnel: at(0, r.progress, 16, r.funnel),
          refusals: at(16, r.progress, 8, r.refusals),
          // The page's full width, so it ends on one line rather than an empty third beside the chart.
          ...(chart && { "paid-by-day": at(0, r.progress + r.funnel, 24, r.paid) }),
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

/** The day chart's and the day lines' title, on the console and on the homepage. */
export const PAID_BY_DAY = "Paid through PayPal, by day";
