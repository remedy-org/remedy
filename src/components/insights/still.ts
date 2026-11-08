import { duration, median } from "@/app/console/_lib/view";
import type { InsightsData } from "@/app/console/insights/facts";
import { funnel, type FunnelStep } from "./funnel";
import { captions, provenance } from "./report";
import type { RefusalItem } from "./widgets/RefusalReasonsView";

// What the homepage's Insights still shows, from the same facts the console's Insights page reads: three KPI tiles, the
// check funnel and the refusal reasons. Pure, so the homepage's numbers are unit-tested against the seed.

export interface StillKpi {
  id: "remedied" | "median" | "refused";
  title: string;
  value: string;
  caption: string;
}

export interface InsightsStillData {
  kpis: StillKpi[];
  steps: FunnelStep[];
  refusals: RefusalItem[];
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
  const say = captions(provenance(data.claims));
  const sum = (k: "remedied" | "refused" | "held") => data.claims.reduce((n, c) => n + c[k], 0);
  const times = data.claims.map((c) => c[say.timeField]).filter((t): t is number => t !== null);
  const mid = median(times);
  const steps = funnel(data.claims);
  const reached = (stage: FunnelStep["stage"]) => steps.find((s) => s.stage === stage)?.reached ?? 0;
  const remedied = sum("remedied");
  const refused = sum("refused");
  return {
    kpis: [
      { id: "remedied", title: "Units remedied", value: remedied.toLocaleString("en-US"), caption: `of ${data.recall.unitsSold.toLocaleString("en-US")} sold` },
      { id: "median", title: say.timeTitle, value: mid === null ? "—" : duration(Math.round(mid)), caption: `${times.length} ${times.length === 1 ? "claim" : "claims"} checked` },
      { id: "refused", title: "Refused", value: refused.toLocaleString("en-US"), caption: "stopped before any money moved" },
    ],
    steps,
    refusals: refusalItems(data.claims),
    totals: {
      claims: data.claims.length,
      photos: reached("Photos sent"),
      preChecked: reached("Passed pre-checks"),
      photoChecked: reached("Passed photo check"),
      paid: reached("Paid"),
      held: sum("held"),
      refused,
      unitsSold: data.recall.unitsSold,
    },
  };
}
