import type { ClaimSummary } from "@/lib/store";
import type { Decision, Recall } from "@/lib/types";
import { amountOf, cents, refusalLabel, statsOf, type Stats } from "./view";

// The CPSC progress-report draft, computed from the claims' index rows. Pure, so the numbers are unit-tested.

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
  // Starter claims the rule approved: filed before PayPal Payouts was connected, never sent.
  sampleCents: number;
  samplesPaid: number;
  seeded: number;
  demo: number;
}

const share = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "—");

export function buildReport(claims: ClaimSummary[], recall: Recall): Report {
  const stats = statsOf(claims, recall);
  const refund = cents(recall.refund);
  const paid = claims.filter((c) => c.decision === "paid");
  const sent = paid.filter((c) => !c.seeded);
  const samples = paid.filter((c) => c.seeded);
  const sum = (list: ClaimSummary[]) => list.reduce((s, c) => s + cents(amountOf(c.payoutAmount, recall)), 0);
  // "Paid" is said only beside a payout really sent: the outcome is the rule's approval. What was sent is the Refunds
  // section's to say, in numbers.
  const unsent = samples.length;
  // One definition per state, in the words the claims grid uses: starter claims, filed before PayPal Payouts was
  // connected, are approved and never pay out, so with any among them the row says approved (the Refunds section
  // reconciles approved and sent); Held is only a claim waiting for a person.
  const paidNote = !unsent ? "Unit destroyed on camera; refund sent through PayPal" : "Unit destroyed on camera; refund approved by the rule";
  const rows: [Decision, string, number, string][] = [
    // Paid when every approved refund went out through PayPal, as the grid's Paid tab counts them.
    ["paid", unsent ? "Approved" : "Paid", stats.remedied, paidNote],
    ["held", "Held", stats.held, "Waiting for a person to approve or reject: an answer was unclear, a check couldn't run, auto-pay was off, or PayPal refused an approved payout"],
    ["rejected", "Rejected", stats.rejected, "A photo check failed, or a person rejected it on review"],
    ["blocked", "Blocked", stats.blocked, "Stopped before the photo check"],
    ["pending", "In progress", stats.pending, "Code issued; photos not yet checked"],
  ];

  const tally = new Map<string, number>();
  for (const c of claims) {
    if (c.decision !== "rejected" && c.decision !== "blocked") continue;
    const check = c.reason?.check ?? "";
    const reason = refusalLabel(check);
    tally.set(reason, (tally.get(reason) ?? 0) + 1);
  }

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
  };
}
