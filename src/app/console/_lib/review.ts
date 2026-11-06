import { PayPalError } from "@/lib/paypal/client";
import { sendPayout, type PayoutStatus } from "@/lib/paypal/payouts";
import { sendCheck } from "@/lib/rule";
import type { Store } from "@/lib/store";
import type { Claim, Reason, Recall } from "@/lib/types";
import { othersFor } from "@/app/api/claims/_lib/pipeline";
import { formatMoney, reviewReasonText } from "./view";

// A person's decision on a held claim. Kept free of Next imports so the money path is unit-tested.

export type ReviewResult =
  | { ok: true; claim: Claim }
  | { ok: false; status: number; code: "not_held" | "seeded" | "send_check" | "paypal"; message: string; reasons?: Reason[]; reference?: string };

interface ReviewInput {
  store: Store;
  claim: Claim;
  recall: Recall;
  // Who decided, for the claim's history: the company's PayPal name or payer id.
  by: string;
  now?: Date;
}

const event = (now: Date, type: string, detail: string) => ({ at: now.toISOString(), type, detail });

// Approve and pay: a fresh read of the claim and the index, sendCheck, then sendPayout with the claim's payoutKey
// (PayPal's request id), so a retried approve can never pay twice. If PayPal fails, the claim stays held.
export async function approveClaim({ store, claim: stale, recall, by, now = new Date(), pay = sendPayout }: ReviewInput & { pay?: typeof sendPayout }): Promise<ReviewResult> {
  const claim = (await store.getClaim(stale.id)) ?? stale;
  if (claim.decision !== "held") return { ok: false, status: 409, code: "not_held", message: `This claim is already ${claim.decision}.` };
  if (claim.seeded) {
    return { ok: false, status: 422, code: "seeded", message: "This is a seeded sample claim with a made-up PayPal account, so it can't be paid." };
  }

  // sendCheck treats any decision but pending as "already decided"; a held claim is exactly what a person may send.
  // The same set the owner's pipeline checked against: demo claims meet only the same judge's demo claims.
  const others = othersFor(claim, await store.listClaims());
  const conflicts = sendCheck({ claim: { ...claim, decision: "pending" }, others });
  if (conflicts.length) {
    await store.putClaim({ ...claim, events: [...claim.events, event(now, "approve_refused", `Not paid on review: ${conflicts.map((r) => r.text).join("; ")}`)] });
    return { ok: false, status: 409, code: "send_check", message: "Remedy didn't send the payout: a check failed when it looked again.", reasons: conflicts };
  }

  const approved: Claim = { ...claim, events: [...claim.events, event(now, "approved", `Approved on review by ${by}`)] };
  await store.putClaim(approved);

  let sent: PayoutStatus;
  try {
    sent = await pay({
      claimId: claim.id,
      payoutKey: claim.payoutKey,
      payerId: claim.payerId,
      amount: recall.refund,
      note: `Refund for CPSC recall ${recall.id}, claim ${claim.id}`,
    });
  } catch (e) {
    const reference = e instanceof PayPalError ? (e.debugId ?? undefined) : undefined;
    const detail = e instanceof Error ? e.message : String(e);
    await store.putClaim({ ...approved, events: [...approved.events, event(new Date(), "payout_failed", `PayPal didn't take the payout: ${detail}`)] });
    return { ok: false, status: 502, code: "paypal", message: "PayPal didn't take the payout. The claim is still held and nothing was paid; try again.", reference };
  }

  const at = new Date();
  const paid: Claim = {
    ...approved,
    decision: "paid",
    reasons: [...approved.reasons, { check: "review", outcome: "pass", text: `Approved on review by ${by}` }],
    payout: { batchId: sent.batchId, itemId: sent.itemId, status: sent.itemStatus ?? sent.batchStatus, updatedAt: at.toISOString(), amount: recall.refund },
    events: [...approved.events, event(at, "payout_sent", `Payout of ${formatMoney(recall.refund)} sent through PayPal`)],
  };
  await store.putClaim(paid);
  return { ok: true, claim: paid };
}

// Reject with a reason the owner can act on. No money moves.
export async function rejectClaim({ store, claim: stale, by, reason, now = new Date() }: ReviewInput & { reason: string }): Promise<ReviewResult> {
  const claim = (await store.getClaim(stale.id)) ?? stale;
  if (claim.decision !== "held") return { ok: false, status: 409, code: "not_held", message: `This claim is already ${claim.decision}.` };
  const text = reviewReasonText(reason);
  const rejected: Claim = {
    ...claim,
    decision: "rejected",
    reasons: [...claim.reasons, { check: "review", outcome: "reject", text }],
    events: [...claim.events, event(now, "rejected", `${text} (by ${by})`)],
  };
  await store.putClaim(rejected);
  return { ok: true, claim: rejected };
}
