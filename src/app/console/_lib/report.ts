import type { ClaimSummary } from "@/lib/store";
import type { Decision, Recall } from "@/lib/types";
import { amountOf, cents, statsOf, type Stats } from "./view";

// The CPSC progress-report draft, computed from the claims' index rows. Pure, so the numbers are unit-tested.

const REFUSAL: Record<string, string> = {
  code: "One-time code missing or wrong",
  screen: "Photo of a screen or a print",
  label: "Label missing or not the recalled product",
  same_item: "Photos showed different items",
  step: "Destruction not shown",
  session: "Photos outside the live camera session",
  duplicate_photo: "Photo already used in another claim",
  payer: "Second claim from one PayPal account",
  payer_verified: "PayPal account not verified",
  review: "Rejected by a person on review",
};

export interface OutcomeRow {
  decision: Decision;
  label: string;
  count: number;
  share: string;
  note: string;
}

export interface Report {
  stats: Stats;
  outcomes: OutcomeRow[];
  refusals: { reason: string; count: number }[];
  refundCents: number;
  // The one amount every paid claim got, or null when the refund changed between payouts.
  paidEachCents: number | null;
  settledCents: number;
  seeded: number;
  demo: number;
  firstClaim: string | null;
  lastClaim: string | null;
}

const share = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "—");

export function buildReport(claims: ClaimSummary[], recall: Recall): Report {
  const stats = statsOf(claims, recall);
  const refund = cents(recall.refund);
  const rows: [Decision, string, number, string][] = [
    ["paid", "Paid", stats.remedied, "Refund sent through PayPal; the unit is destroyed"],
    ["held", "Held for review", stats.held, "An answer was unclear, or auto-pay was off"],
    ["rejected", "Rejected", stats.rejected, "A photo check failed"],
    ["blocked", "Blocked", stats.blocked, "Stopped before the photo check"],
    ["pending", "In progress", stats.pending, "Code issued; photos not yet checked"],
  ];

  const tally = new Map<string, number>();
  for (const c of claims) {
    if (c.decision !== "rejected" && c.decision !== "blocked") continue;
    const check = c.reason?.check ?? "";
    const reason = REFUSAL[check.startsWith("step_") ? "step" : check] ?? "Other";
    tally.set(reason, (tally.get(reason) ?? 0) + 1);
  }

  const times = claims.map((c) => c.createdAt).sort();
  const paidAmounts = new Set(claims.filter((c) => c.decision === "paid").map((c) => cents(amountOf(c.payoutAmount, recall))));
  const settledCents = claims.filter((c) => c.decision === "paid" && c.payoutStatus === "SUCCESS").reduce((sum, c) => sum + cents(amountOf(c.payoutAmount, recall)), 0);
  return {
    stats,
    outcomes: rows.map(([decision, label, count, note]) => ({ decision, label, count, share: share(count, stats.total), note })),
    refusals: [...tally].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)),
    refundCents: refund,
    paidEachCents: paidAmounts.size === 1 ? [...paidAmounts][0] : null,
    settledCents,
    seeded: claims.filter((c) => c.seeded).length,
    demo: claims.filter((c) => c.demo).length,
    firstClaim: times[0] ?? null,
    lastClaim: times.at(-1) ?? null,
  };
}
