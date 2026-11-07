import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockPayPal, tokenResponse } from "./test-helpers";

beforeEach(() => vi.resetModules());
const load = () => import("./webhooks");

const headers = new Headers({
  "paypal-auth-algo": "SHA256withRSA",
  "paypal-cert-url": "https://api.sandbox.paypal.com/v1/notifications/certs/CERT",
  "paypal-transmission-id": "tid",
  "paypal-transmission-sig": "sig",
  "paypal-transmission-time": "2026-11-07T10:00:00Z",
});

const event = {
  id: "WH-EVT-1",
  create_time: "2026-11-07T10:01:00.000Z",
  event_type: "PAYMENT.PAYOUTS-ITEM.SUCCEEDED",
  resource: {
    payout_item_id: "I1",
    payout_batch_id: "B1",
    transaction_status: "SUCCESS",
    payout_item: { recipient_type: "PAYPAL_ID", receiver: "47KT8H23PUJ3Q", sender_item_id: "RM-0412", amount: { value: "29.99", currency: "USD" } },
  },
};

describe("verifyWebhook", () => {
  it("asks PayPal to verify, passing the event bytes through untouched", async () => {
    const calls = mockPayPal(tokenResponse, { body: { verification_status: "SUCCESS" } });
    const { verifyWebhook } = await load();
    const raw = '{"id":"WH-EVT-1","amount":1.10,"event_type":"PAYMENT.PAYOUTS-ITEM.SUCCEEDED"}';
    expect(await verifyWebhook(headers, raw)).toBe(true);

    expect(calls[1].url).toBe("https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature");
    expect(calls[1].body).toContain(`"webhook_event":${raw}}`);
    expect(JSON.parse(calls[1].body!)).toMatchObject({ webhook_id: "WH-1", auth_algo: "SHA256withRSA", transmission_sig: "sig", transmission_time: "2026-11-07T10:00:00Z" });
  });

  it("is false on FAILURE, missing headers or a malformed body", async () => {
    mockPayPal(tokenResponse, { body: { verification_status: "FAILURE" } });
    const { verifyWebhook } = await load();
    expect(await verifyWebhook(headers, JSON.stringify(event))).toBe(false);
    expect(await verifyWebhook(new Headers(), JSON.stringify(event))).toBe(false);
    expect(await verifyWebhook(headers, "{not json")).toBe(false);
  });
});

describe("parsePayoutItemEvent", () => {
  it("reads a payout item event", async () => {
    const { parsePayoutItemEvent } = await load();
    expect(parsePayoutItemEvent(event)).toEqual({ eventId: "WH-EVT-1", type: "PAYMENT.PAYOUTS-ITEM.SUCCEEDED", itemId: "I1", batchId: "B1", status: "SUCCESS", claimId: "RM-0412", createdAt: new Date("2026-11-07T10:01:00.000Z") });
  });

  it("leaves createdAt out when create_time is missing or unreadable", async () => {
    const { parsePayoutItemEvent } = await load();
    expect(parsePayoutItemEvent({ ...event, create_time: undefined })).not.toHaveProperty("createdAt");
    expect(parsePayoutItemEvent({ ...event, create_time: "yesterday" })).not.toHaveProperty("createdAt");
  });

  it("applies an event only to the claim whose payout has its batch id", async () => {
    const { parsePayoutItemEvent, isForClaim } = await load();
    const update = parsePayoutItemEvent(event)!;
    const payout = { batchId: "B1", status: "PENDING", updatedAt: "2026-11-07T10:00:00.000Z" };
    expect(isForClaim(update, { id: "RM-0412", payout })).toBe(true);
    // Same claim id in another store, paid by another batch.
    expect(isForClaim(update, { id: "RM-0412", payout: { ...payout, batchId: "B9" } })).toBe(false);
    expect(isForClaim(update, { id: "RM-0412", payout: null })).toBe(false);
    expect(isForClaim(update, { id: "RM-0500", payout })).toBe(false);
  });

  it("ignores other events", async () => {
    const { parsePayoutItemEvent } = await load();
    expect(parsePayoutItemEvent({ ...event, event_type: "PAYMENT.PAYOUTSBATCH.SUCCESS" })).toBeNull();
    expect(parsePayoutItemEvent({ hello: "world" })).toBeNull();
  });
});
