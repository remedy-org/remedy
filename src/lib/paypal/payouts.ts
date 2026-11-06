import { z } from "zod";
import type { Money } from "../types";
import { paypal } from "./client";

export interface PayoutStatus {
  batchId: string;
  batchStatus: string;
  itemId?: string;
  // SUCCESS, PENDING, UNCLAIMED, FAILED, RETURNED, ONHOLD, BLOCKED...
  itemStatus?: string;
}

const Created = z.object({ batch_header: z.object({ payout_batch_id: z.string(), batch_status: z.string() }) });

// The claim's payoutKey is the request id and batch id, so a retried send can never pay twice. It is unique across
// stores, unlike the claim id, which only goes in sender_item_id so webhooks can find the claim.
export async function sendPayout({ claimId, payoutKey, payerId, amount, note }: { claimId: string; payoutKey: string; payerId: string; amount: Money; note: string }): Promise<PayoutStatus> {
  const res = await paypal("POST", "/v1/payments/payouts", Created, {
    requestId: payoutKey,
    json: {
      sender_batch_header: { sender_batch_id: payoutKey, email_subject: "Your recall refund" },
      items: [{
        recipient_type: "PAYPAL_ID",
        amount: { value: amount.value, currency: amount.currency },
        receiver: payerId,
        note,
        sender_item_id: claimId,
      }],
    },
  });
  return { batchId: res.batch_header.payout_batch_id, batchStatus: res.batch_header.batch_status };
}

const Batch = z.object({
  batch_header: z.object({ payout_batch_id: z.string(), batch_status: z.string() }),
  items: z.array(z.object({ payout_item_id: z.string(), transaction_status: z.string().optional() })).optional(),
});

// One item per batch, so the batch's first item is the claim's payout.
export async function getPayoutStatus(batchId: string): Promise<PayoutStatus> {
  const res = await paypal("GET", `/v1/payments/payouts/${encodeURIComponent(batchId)}`, Batch);
  const item = res.items?.[0];
  return { batchId: res.batch_header.payout_batch_id, batchStatus: res.batch_header.batch_status, itemId: item?.payout_item_id, itemStatus: item?.transaction_status };
}
