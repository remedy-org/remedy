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
 * The figures over the report, in the console ledger's words: units remedied, money really sent through PayPal with
 * what was approved and not sent beside it, the median time (photo to payout, or the photo check while nothing was
 * sent: one claim a person approved hours later would drag an average to minutes) and refusals.
 */
export function insightsLedger(claims: LedgerRow[]) {
  const field = timeField(claims);
  const times = claims.map((c) => c[field]).filter((t): t is number => t !== null);
  const paidCents = claims.reduce((n, c) => n + cents(c.amountSent), 0);
  return {
    remedied: claims.reduce((n, c) => n + c.remedied, 0),
    paidCents,
    unsentCents: claims.reduce((n, c) => n + Math.max(0, cents(c.amountPaid) - cents(c.amountSent)), 0),
    median: median(times),
    timeLabel: field === "timeToSendSec" ? "median photo to payout" : "median photo check",
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

// How the filter bar names a pick: a refusal reason reads as itself, a funnel drop by the furthest stage its claims
// reached (the grid's "Furthest stage"), a day as filed.
const or = (values: string[]) => values.map(shownAs).join(" or ");
const PICK_LABEL: Record<string, (values: string[]) => string> = {
  "claims.stage": (v) => `Furthest stage: ${or(v)}`,
  "claims.decision": (v) => `Verdict: ${or(v)}`,
  [DAY]: (v) => `Filed ${or(v.map((d) => `${Number(d.slice(6))} ${MONTHS[Number(d.slice(4, 6)) - 1] ?? ""}`.trim()))}`,
};

/** "Rejected by a person on review", "Furthest stage: Photos sent · Decision: Held"; a pick this can't name reads as a chart's. */
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
    ? { progress: 15, decisions: 14, funnel: tall, refusals: Math.ceil((72 + reasonCount(data) * 58) / 16) }
    : { progress: 15, decisions: 15, funnel: tall, refusals: tall };
};

/** The canvas rows the report takes: what the page sizes Studio's host to, so the page scrolls and the canvas never does. */
export const reportRows = (data: InsightsData, narrow = false) => {
  const r = rowsOf(data, narrow);
  return narrow ? r.progress + r.decisions + r.funnel + r.refusals : r.progress + r.funnel;
};

// Every claim is one click away in the claims grid (the page header links it), so the report is the figures alone: no
// second table of the same rows. Below 1024px each panel takes the canvas's full width, one under another.
const overview = (data: InsightsData, narrow: boolean): AgPageState<InsightsRegistry> => {
  const r = rowsOf(data, narrow);
  return {
    id: "overview",
    widgets: {
      progress: {
        type: "recall-progress",
        dataMapping: {
          remedied: [sum("claims.remedied")],
          sold: [{ id: "recall.unitsSold", aggregation: "max" }],
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
    },
    widgetLayout: narrow
      ? {
          progress: at(0, 0, 24, r.progress),
          decisions: at(0, r.progress, 24, r.decisions),
          funnel: at(0, r.progress + r.decisions, 24, r.funnel),
          refusals: at(0, r.progress + r.decisions + r.funnel, 24, r.refusals),
        }
      : {
          progress: at(0, 0, 16, r.progress),
          decisions: at(16, 0, 8, r.decisions),
          funnel: at(0, r.progress, 16, r.funnel),
          refusals: at(16, r.progress, 8, r.refusals),
        },
  };
};

export const insightsReport = (data: InsightsData, narrow = false): AgReportState<InsightsRegistry> => ({
  selectedPageId: "overview",
  pages: [overview(data, narrow)],
  panels: {
    // The analyst opens on demand from "Ask about this recall" in the page header: the report leads, not an empty chat.
    ai: { collapsed: true },
    filters: { collapsed: true },
    edit: { collapsed: true },
    data: { collapsed: true },
  },
});
