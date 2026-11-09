import { PayPalError } from "@/lib/paypal/client";
import { sendPayout, type PayoutStatus } from "@/lib/paypal/payouts";
import { sendCheck } from "@/lib/rule";
import type { ClaimSummary, Store } from "@/lib/store";
import type { Claim, Reason, Recall } from "@/lib/types";
import { othersFor, payoutFailedDetail, payoutNote } from "@/app/api/claims/_lib/pipeline";
import { decideStarter, type StarterDecision } from "./starter";
import { formatMoney, reviewReasonText } from "./view";

// A person's decision on a held claim. Kept free of Next imports so the money path is unit-tested. Every save goes
// through store.updateClaim, so a decision is written only over the claim it was made on: a webhook or payout refresh
// that lands in between is kept, never overwritten.

export type ReviewResult =
  // starter: a starter claim's decision, which the route keeps for the company (starter.ts); the shared record stays held.
  | { ok: true; claim: Claim; starter?: StarterDecision }
  | { ok: false; status: number; code: "not_held" | "send_check" | "paypal"; message: string; reasons?: Reason[]; reference?: string };

interface ReviewInput {
  store: Store;
  claim: Claim;
  recall: Recall;
  // Who decided, for the claim's history: the company's PayPal name or payer id.
  by: string;
  now?: Date;
}

const event = (now: Date, type: string, detail: string) => ({ at: now.toISOString(), type, detail });

const append = (c: Claim, at: Date, type: string, detail: string): Claim => ({ ...c, events: [...c.events, event(at, type, detail)] });

async function notHeld(store: Store, id: string): Promise<ReviewResult> {
  const current = await store.getClaim(id);
  return { ok: false, status: 409, code: "not_held", message: current ? `This claim is already ${current.decision}.` : "This claim is gone." };
}

// Starter (seeded) claims sit on the shared recall, in every company's console. Reviewing one answers with the claim as
// decided and the decision for the route to keep for this company (starter.ts): the shared record stays held, so one
// company's decision never empties the next company's review queue.

/**
 * What the checks run again on approve would stop the payout for, from index.json's rows: the same set the owner's
 * pipeline checked against (othersFor; demo claims meet only their own round's). Empty means approve would pay. The
 * evidence panel shows it before the decision, so what the reviewer reads is what approve will do.
 */
export function approveConflicts(claim: Claim, rows: ClaimSummary[]): Reason[] {
  // sendCheck treats any decision but pending as "already decided"; a held claim is exactly what a person may send.
  return sendCheck({ claim: { ...claim, decision: "pending" }, others: othersFor(claim, rows) });
}

// Approve and pay: a fresh read of the claim and the index, sendCheck, then sendPayout with the claim's payoutKey
// (PayPal's request id), as the owner's pipeline does, so a retried approve can never pay twice. If PayPal fails, the
// claim stays held.
export async function approveClaim({ store, claim: stale, recall, by, now = new Date(), pay = sendPayout }: ReviewInput & { pay?: typeof sendPayout }): Promise<ReviewResult> {
  const claim = (await store.getClaim(stale.id)) ?? stale;
  if (claim.decision !== "held") return notHeld(store, claim.id);
  const amount = formatMoney(recall.refund);
  if (claim.seeded) {
    const starter: StarterDecision = { k: "approve", at: now.toISOString(), by: by.slice(0, 120) };
    return { ok: true, claim: decideStarter(claim, starter, recall), starter };
  }

  const conflicts = approveConflicts(claim, await store.listClaims());
  if (conflicts.length) {
    // The conflicts join the claim's reasons as holds, as the pipeline's own sendCheck does, so the queue and the
    // pre-checks show what stopped the payout. Appended: the reason it was first held still leads (decidingReason).
    await store.updateClaim(claim.id, (c) => {
      if (c.decision !== "held") return null;
      const fresh = conflicts.filter((r) => !c.reasons.some((o) => o.check === r.check && o.text === r.text));
      return append({ ...c, reasons: [...c.reasons, ...fresh] }, now, "approve_refused", `Not paid on review: ${conflicts.map((r) => r.text).join("; ")}`);
    });
    return { ok: false, status: 409, code: "send_check", message: "Remedy didn't send the payout: a check failed when it looked again.", reasons: conflicts };
  }

  const approved = await store.updateClaim(claim.id, (c) => (c.decision === "held" ? append(c, now, "approved", `Approved on review by ${by}`) : null));
  if (!approved) return notHeld(store, claim.id);

  let sent: PayoutStatus;
  try {
    sent = await pay({ claimId: claim.id, payoutKey: claim.payoutKey, payerId: claim.payerId, amount: recall.refund, note: payoutNote(recall, claim) });
  } catch (e) {
    const reference = e instanceof PayPalError ? (e.debugId ?? undefined) : undefined;
    await store.updateClaim(claim.id, (c) => append(c, new Date(), "payout_failed", payoutFailedDetail(e)));
    const what = e instanceof PayPalError ? "PayPal didn't take the payout" : "Remedy couldn't reach PayPal";
    return { ok: false, status: 502, code: "paypal", message: `${what}. Nothing was sent and the claim is still held; it's safe to try again.`, reference };
  }

  // PayPal has the money, so the claim says paid whatever happened to it meanwhile. An approve that got here first
  // (the same payoutKey, so the same batch) has already saved it.
  const at = new Date();
  const paid = await store.updateClaim(claim.id, (c) =>
    c.payout?.batchId === sent.batchId
      ? null
      : {
          ...c,
          decision: "paid",
          reasons: [...c.reasons, { check: "review", outcome: "pass", text: `Approved on review by ${by}` }],
          payout: { batchId: sent.batchId, ...(sent.itemId ? { itemId: sent.itemId } : {}), status: sent.itemStatus ?? sent.batchStatus, updatedAt: at.toISOString(), amount: recall.refund },
          events: [...c.events, event(at, "payout_sent", `Payout of ${amount} sent through PayPal`)],
        },
  );
  const saved = paid ?? (await store.getClaim(claim.id));
  if (!saved) throw new Error(`Claim ${claim.id} is gone after its payout was sent (batch ${sent.batchId})`);
  return { ok: true, claim: saved };
}

// Reject with a reason the owner can act on. No money moves.
export async function rejectClaim({ store, claim: stale, recall, by, reason, now = new Date() }: ReviewInput & { reason: string }): Promise<ReviewResult> {
  const claim = (await store.getClaim(stale.id)) ?? stale;
  if (claim.decision !== "held") return notHeld(store, claim.id);
  const text = reviewReasonText(reason);
  if (claim.seeded) {
    const starter: StarterDecision = { k: "reject", at: now.toISOString(), by: by.slice(0, 120), r: reason };
    return { ok: true, claim: decideStarter(claim, starter, recall), starter };
  }
  const rejected = await store.updateClaim(claim.id, (c) =>
    c.decision === "held"
      ? { ...c, decision: "rejected", reasons: [...c.reasons, { check: "review", outcome: "reject", text }], events: [...c.events, event(now, "rejected", `${text} (by ${by})`)] }
      : null,
  );
  return rejected ? { ok: true, claim: rejected } : notHeld(store, claim.id);
}
