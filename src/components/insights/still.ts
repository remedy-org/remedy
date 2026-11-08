import { median } from "@/app/console/_lib/view";
import type { InsightsData } from "@/app/console/insights/facts";
import { funnel, reasonList, type FunnelStep } from "./funnel";
import { homeKpiCaptions, homeTime, spokenTime } from "./report";
import type { RefusalItem } from "./widgets/RefusalReasonsView";

// What the homepage's Insights still shows, from the same facts the console's Insights page reads: three KPI tiles, the
// check funnel and the refusal reasons. Pure, so the homepage's numbers are unit-tested against the seed.

export interface StillKpi {
  id: "remedied" | "median" | "refused";
  title: string;
  /** A shorter title for a phone's narrow tile. */
  phone?: string;
  value: string;
  caption: string;
}

/** One day's payouts: the claims paid that day (UTC, as Studio's calendar buckets them) and the dollars sent. */
export interface PaidDay {
  day: string;
  label: string;
  paid: number;
  dollars: number;
}

export interface InsightsStillData {
  kpis: StillKpi[];
  steps: FunnelStep[];
  refusals: RefusalItem[];
  days: PaidDay[];
  /** The totals the tour's descriptions are written from. */
  totals: { claims: number; photos: number; preChecked: number; photoChecked: number; paid: number; held: number; refused: number; unitsSold: number };
}

/** The refusal reasons with their gate and count, commonest first, as the console's "Why claims were refused" lists them. */
export function refusalItems(claims: Pick<InsightsData["claims"][number], "refusalReason" | "refusalGate">[]): RefusalItem[] {
  const tally = new Map<string, RefusalItem>();
  for (const c of claims) {
    if (!c.refusalReason) continue;
    const item = tally.get(c.refusalReason) ?? { reason: c.refusalReason, gate: c.refusalGate ?? "", count: 0 };
    item.count++;
    tally.set(c.refusalReason, item);
  }
  return [...tally.values()].sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
}

/** Dollars paid through PayPal per day, oldest first, every day from the first claim to the last (a quiet day shows 0). */
export function paidByDay(claims: Pick<InsightsData["claims"][number], "filedAt" | "amountSent" | "remedied">[]): PaidDay[] {
  if (!claims.length) return [];
  const days = claims.map((c) => c.filedAt.slice(0, 10)).sort();
  const out: PaidDay[] = [];
  for (let t = Date.parse(days[0]); t <= Date.parse(days.at(-1)!); t += 86_400_000) {
    const day = new Date(t).toISOString().slice(0, 10);
    const on = claims.filter((c) => c.filedAt.startsWith(day));
    const label = new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
    out.push({ day, label, paid: on.reduce((n, c) => n + c.remedied, 0), dollars: Math.round(on.reduce((n, c) => n + c.amountSent, 0) * 100) / 100 });
  }
  return out;
}

export function insightsStill(data: InsightsData): InsightsStillData {
  const say = homeTime(data.claims);
  const sum = (k: "remedied" | "refused" | "held") => data.claims.reduce((n, c) => n + c[k], 0);
  const times = data.claims.map((c) => c[say.timeField]).filter((t): t is number => t !== null);
  const mid = median(times);
  const steps = funnel(data.claims, reasonList);
  const reached = (stage: FunnelStep["stage"]) => steps.find((s) => s.stage === stage)?.reached ?? 0;
  const remedied = sum("remedied");
  const refused = sum("refused");
  const home = homeKpiCaptions(data.claims);
  return {
    kpis: [
      { id: "remedied", title: "Units remedied", value: remedied.toLocaleString("en-US"), caption: `of ${data.recall.unitsSold.toLocaleString("en-US")} sold` },
      { id: "median", title: say.timeTitle, phone: say.timeField === "timeToSendSec" ? "Median to payout" : undefined, value: mid === null ? "—" : spokenTime(Math.round(mid)), caption: home.median },
      { id: "refused", title: "Refused", value: refused.toLocaleString("en-US"), caption: home.refused },
    ],
    steps,
    refusals: refusalItems(data.claims),
    days: paidByDay(data.claims),
    totals: {
      claims: data.claims.length,
      photos: reached("Photos sent"),
      preChecked: reached("Passed account checks"),
      photoChecked: reached("Passed photo check"),
      paid: reached("Paid"),
      held: sum("held"),
      refused,
      unitsSold: data.recall.unitsSold,
    },
  };
}
