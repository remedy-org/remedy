import type { InsightsData } from "@/app/console/insights/facts";
import { funnel, type FunnelStep } from "./funnel";
import { paidDays } from "./report";
import { decisionItems } from "./widgets/DecisionMixView";
import type { RefusalItem } from "./widgets/RefusalReasonsView";

// What the homepage's Insights still shows, from the same facts the console's Insights page reads, panel for panel: the
// ledger, Recall progress, Decisions, Where claims stop, Why claims were refused and what PayPal paid by day. Pure, so
// the homepage's numbers are unit-tested against the seed.

export interface InsightsStillData {
  /** The facts themselves: the ledger and the phone's summary read them as the console's do. */
  insights: InsightsData;
  progress: { done: number; total: number; dayCount: number };
  decisions: { label: string; n: number }[];
  steps: FunnelStep[];
  refusals: RefusalItem[];
  days: ReturnType<typeof paidDays>;
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

export function insightsStill(data: InsightsData): InsightsStillData {
  const sum = (k: "remedied" | "refused" | "held") => data.claims.reduce((n, c) => n + c[k], 0);
  const steps = funnel(data.claims);
  const reached = (stage: FunnelStep["stage"]) => steps.find((s) => s.stage === stage)?.reached ?? 0;
  const tally = new Map<string, number>();
  for (const c of data.claims) tally.set(c.decision, (tally.get(c.decision) ?? 0) + 1);
  return {
    insights: data,
    progress: { done: sum("remedied"), total: data.recall.unitsSold, dayCount: data.recall.daysIn },
    decisions: decisionItems(tally),
    steps,
    refusals: refusalItems(data.claims),
    days: paidDays(data.claims),
    totals: {
      claims: data.claims.length,
      photos: reached("Photos sent"),
      preChecked: reached("Passed checks before the photo check"),
      photoChecked: reached("Passed photo check"),
      paid: reached("Paid"),
      held: sum("held"),
      refused: sum("refused"),
      unitsSold: data.recall.unitsSold,
    },
  };
}
