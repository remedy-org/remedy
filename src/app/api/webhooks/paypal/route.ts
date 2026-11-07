import { NextResponse } from "next/server";
import { getAppStore } from "@/lib/demo";
import { env } from "@/lib/env";
import { savePayoutStatus } from "@/lib/paypal/status";
import { parsePayoutItemEvent, verifyWebhook } from "@/lib/paypal/webhooks";

let warned = false;

// POST /api/webhooks/paypal: PAYMENT.PAYOUTS-ITEM.* events move a claim's stored payout status. Nothing in the body
// is trusted until PayPal verifies the signature. Any 2xx stops PayPal retrying, so other and unrelated events get
// 200, and only a failure on our side (no webhook id, verification unreachable, the store down) answers 5xx.
export async function POST(request: Request) {
  if (!env().PAYPAL_WEBHOOK_ID) {
    if (!warned) console.error("PayPal webhook refused: PAYPAL_WEBHOOK_ID is not set, so events can't be verified");
    warned = true;
    return NextResponse.json({ error: "Webhooks aren't set up." }, { status: 503 });
  }

  // The raw text, not request.json(): verification needs the bytes exactly as PayPal sent them.
  const raw = await request.text();
  let verified: boolean;
  try {
    verified = await verifyWebhook(request.headers, raw);
  } catch (e) {
    console.error("PayPal webhook verification failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Couldn't verify the event." }, { status: 502 });
  }
  if (!verified) return NextResponse.json({ error: "The signature didn't verify." }, { status: 400 });

  const update = parsePayoutItemEvent(JSON.parse(raw));
  if (!update?.claimId) return NextResponse.json({ ignored: true });

  const store = await getAppStore();
  const saved = await savePayoutStatus(store, update.claimId, update.batchId, { status: update.status, itemId: update.itemId, at: update.createdAt ?? new Date() });
  return NextResponse.json({ updated: Boolean(saved) });
}
