import type { Decision } from "./types";

// One payout vocabulary for every surface (the queue's tabs, rows, header and footer, Insights, the CPSC report, the
// CSV, the homepage tour and /signin), so their words and totals agree. A claim the rule or a person approved is in one
// of three states:
//   Paid             PayPal confirmed the payout (SUCCESS).
//   Sent, settling   sent through PayPal, not confirmed yet.
//   Approved         the rule passed it or the company approved it, and nothing was sent.
// A payout PayPal refused or returned paid nothing: Approved, its payout column says Refused.

export type MoneyState = "paid" | "settling" | "approved";

export const MONEY_WORD: Record<MoneyState, string> = { paid: "Paid", settling: "Sent, settling", approved: "Approved" };

/** A claim's history line when PayPal confirms its payout (PayPal's own word, SUCCESS, is what the store records). */
export const PAYPAL_CONFIRMED = "PayPal confirmed the payout";

const NOT_LANDED = new Set(["FAILED", "RETURNED", "BLOCKED", "DENIED", "REVERSED", "REFUNDED", "CANCELED"]);

/** Where an approved claim's money is, or null for a claim nobody approved. */
export function moneyState(r: { decision: Decision; payoutStatus: string | null }): MoneyState | null {
  if (r.decision !== "paid") return null;
  if (r.payoutStatus === "SUCCESS") return "paid";
  return r.payoutStatus && !NOT_LANDED.has(r.payoutStatus) ? "settling" : "approved";
}

/** The approved claims' money in each state, in cents: the queue's footer. */
export function moneyCents(rows: { decision: Decision; payoutStatus: string | null; cents: number | null }[]): Record<MoneyState, number> {
  const n = { paid: 0, settling: 0, approved: 0 };
  for (const r of rows) {
    const s = moneyState(r);
    if (s) n[s] += r.cents ?? 0;
  }
  return n;
}

/** How many approved claims are in each state. */
export function moneyCounts(rows: { decision: Decision; payoutStatus: string | null }[]): Record<MoneyState, number> {
  const n = { paid: 0, settling: 0, approved: 0 };
  for (const r of rows) {
    const s = moneyState(r);
    if (s) n[s]++;
  }
  return n;
}
