import { z } from "zod";
import { env } from "../env";
import type { Claim } from "../types";
import { paypal } from "./client";

const HEADERS = {
  auth_algo: "paypal-auth-algo",
  cert_url: "paypal-cert-url",
  transmission_id: "paypal-transmission-id",
  transmission_sig: "paypal-transmission-sig",
  transmission_time: "paypal-transmission-time",
} as const;

const Verification = z.object({ verification_status: z.enum(["SUCCESS", "FAILURE"]) });

// PayPal checks the signature itself. Dashboard simulator events can't pass this; use real sandbox payouts.
export async function verifyWebhook(headers: Headers, rawBody: string): Promise<boolean> {
  const webhookId = env().PAYPAL_WEBHOOK_ID;
  if (!webhookId) throw new Error("PAYPAL_WEBHOOK_ID is not set");
  const fields: Record<string, string> = { webhook_id: webhookId };
  for (const [field, header] of Object.entries(HEADERS)) {
    const value = headers.get(header);
    if (!value) return false;
    fields[field] = value;
  }
  try {
    JSON.parse(rawBody);
  } catch {
    return false;
  }
  // The event goes in exactly as received: re-serializing it can change bytes and fail the check.
  const body = `${JSON.stringify(fields).slice(0, -1)},"webhook_event":${rawBody}}`;
  const res = await paypal("POST", "/v1/notifications/verify-webhook-signature", Verification, { raw: body });
  return res.verification_status === "SUCCESS";
}

const PayoutItemEvent = z.object({
  id: z.string(),
  event_type: z.string().startsWith("PAYMENT.PAYOUTS-ITEM."),
  resource: z.object({
    payout_item_id: z.string(),
    payout_batch_id: z.string(),
    transaction_status: z.string(),
    payout_item: z.object({ sender_item_id: z.string().optional() }).optional(),
  }),
});

export interface PayoutItemUpdate {
  // For de-duplication: PayPal retries deliveries.
  eventId: string;
  type: string;
  itemId: string;
  batchId: string;
  status: string;
  // sendPayout sets this to the claim id.
  claimId?: string;
}

// Null for any event that isn't a PAYMENT.PAYOUTS-ITEM.* event.
export function parsePayoutItemEvent(event: unknown): PayoutItemUpdate | null {
  const parsed = PayoutItemEvent.safeParse(event);
  if (!parsed.success) return null;
  const { id, event_type, resource } = parsed.data;
  return {
    eventId: id,
    type: event_type,
    itemId: resource.payout_item_id,
    batchId: resource.payout_batch_id,
    status: resource.transaction_status,
    claimId: resource.payout_item?.sender_item_id,
  };
}

// Every webhook URL on the PayPal app gets every event, and claim ids repeat across stores, so an event only
// belongs to a claim whose own payout has that batch id. An event that lands before the batch id is saved is
// dropped; getPayoutStatus catches up.
export function isForClaim(update: PayoutItemUpdate, claim: Pick<Claim, "id" | "payout">): boolean {
  return update.claimId === claim.id && claim.payout?.batchId === update.batchId;
}
