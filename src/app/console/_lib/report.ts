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
  // Money really sent through PayPal: paid claims other than the seeded samples, whose payouts never left.
  sentCents: number;
  sent: number;
  // Of that, what PayPal has confirmed, and how many payouts are still settling.
  settledCents: number;
  settling: number;
  // Seeded samples the rule "paid": decided, never sent.
  sampleCents: number;
  samplesPaid: number;
  seeded: number;
  demo: number;
  firstClaim: string | null;
  lastClaim: string | null;
}

const share = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "—");

export function buildReport(claims: ClaimSummary[], recall: Recall): Report {
  const stats = statsOf(claims, recall);
  const refund = cents(recall.refund);
  const paid = claims.filter((c) => c.decision === "paid");
  const sent = paid.filter((c) => !c.seeded);
  const samples = paid.filter((c) => c.seeded);
  const sum = (list: ClaimSummary[]) => list.reduce((s, c) => s + cents(amountOf(c.payoutAmount, recall)), 0);
  // "Paid" is said only beside a payout really sent: the outcome is the rule's approval, and the note says what was sent.
  const unsent = samples.length;
  const paidNote = !unsent
    ? "The unit is destroyed and the refund sent through PayPal"
    : `The unit is destroyed and the refund approved; ${unsent === paid.length ? "not sent, as the payees' PayPal accounts" : `${unsent} not sent, as those payees' PayPal accounts`} aren't live`;
  const rows: [Decision, string, number, string][] = [
    ["paid", "Approved", stats.remedied, paidNote],
    ["held", "Held", stats.held, "Waiting for a person: an answer was unclear, a check couldn't run, PayPal didn't take the payout, or auto-pay was off"],
    ["rejected", "Rejected", stats.rejected, "A photo check failed, or a person rejected it on review"],
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
  const paidAmounts = new Set(paid.map((c) => cents(amountOf(c.payoutAmount, recall))));
  const settled = sent.filter((c) => c.payoutStatus === "SUCCESS");
  return {
    stats,
    outcomes: rows.map(([decision, label, count, note]) => ({ decision, label, count, share: share(count, stats.total), note })),
    refusals: [...tally].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)),
    refundCents: refund,
    paidEachCents: paidAmounts.size === 1 ? [...paidAmounts][0] : null,
    sentCents: sum(sent),
    sent: sent.length,
    settledCents: sum(settled),
    settling: sent.length - settled.length,
    sampleCents: sum(samples),
    samplesPaid: samples.length,
    seeded: claims.filter((c) => c.seeded).length,
    demo: claims.filter((c) => c.demo).length,
    firstClaim: times[0] ?? null,
    lastClaim: times.at(-1) ?? null,
  };
}
