import "server-only";
import { isTerminal, refreshPayouts } from "@/lib/paypal/status";
import type { Store } from "@/lib/store";
import type { Claim } from "@/lib/types";

// The paid receipt's live PayPal status. The receipt polls GET /api/claims/<id>/status, one Blob read a poll, which
// sees a status a webhook saved. PayPal itself is asked at most once a minute per claim per server instance (the
// console's own recheck rate, docs/PRODUCT.md), through refreshPayouts and its limits: one claim, a 3 s timeout, and a
// save only when the status changed. The claim page's render asks PayPal too, and counts as an ask here.

export const RECHECK_MS = 60_000;
const asked = new Map<string, number>();

/** Records that PayPal was just asked about this claim's payout. */
export function markAsked(claimId: string, now = Date.now()) {
  if (asked.size > 500) for (const [id, at] of asked) if (now - at >= RECHECK_MS) asked.delete(id);
  asked.set(claimId, now);
}

/** Whether a sent payout can still change and PayPal wasn't asked about it within the last minute here. */
export function recheckDue(claim: Pick<Claim, "id" | "decision" | "payout">, now = Date.now()): boolean {
  if (claim.decision !== "paid" || !claim.payout || isTerminal(claim.payout.status)) return false;
  return now - (asked.get(claim.id) ?? 0) >= RECHECK_MS;
}

/** The claim with PayPal's latest word on its payout when a recheck is due (saved if it moved); otherwise as given. */
export async function recheckPayout(store: Store, claim: Claim, now = Date.now()): Promise<Claim> {
  if (!recheckDue(claim, now)) return claim;
  markAsked(claim.id, now);
  const [latest] = await refreshPayouts(store, [claim], { limit: 1 });
  return latest ?? claim;
}
