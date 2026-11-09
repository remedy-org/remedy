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
  // Money sent through PayPal.
  sentCents: number;
  sent: number;
  // Of that, what PayPal has confirmed, and how many payouts are still settling.
  settledCents: number;
  settling: number;
  demo: number;
}

const share = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "—");

export function buildReport(claims: ClaimSummary[], recall: Recall): Report {
  const stats = statsOf(claims, recall);
  const refund = cents(recall.refund);
  const paid = claims.filter((c) => c.decision === "paid");
  // Sent: a payout went to PayPal. An approved claim with nothing sent counts as approved, never as money sent.
  const sent = paid.filter((c) => c.payoutStatus !== null);
  const confirmed = paid.filter((c) => c.payoutStatus === "SUCCESS").length;
  const sum = (list: ClaimSummary[]) => list.reduce((s, c) => s + cents(amountOf(c.payoutAmount, recall)), 0);
  // One definition per state, in the words the claims grid uses; Held is only a claim waiting for a person.
  const rows: [Decision, string, number, string][] = [
    // Paid only where PayPal confirmed the payout; a claim the rule or a person approved with nothing paid yet is Approved.
    ["paid", "Paid", confirmed, "Unit destroyed on camera; refund paid through PayPal"],
    ...(stats.remedied > confirmed ? [["paid", "Approved", stats.remedied - confirmed, "Unit destroyed on camera; refund approved, not yet paid through PayPal"] as [Decision, string, number, string]] : []),
    ["held", "Held", stats.held, "Waiting for a person to approve or reject: an answer was unclear, a check couldn’t run, auto-pay was off, or PayPal refused an approved payout"],
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
    demo: claims.filter((c) => c.demo).length,
  };
}
