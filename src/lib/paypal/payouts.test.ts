import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockPayPal, tokenResponse } from "./test-helpers";

beforeEach(() => vi.resetModules());
const load = () => import("./payouts");

describe("sendPayout", () => {
  it("pays the PAYPAL_ID, keyed on the claim's payout key, not its reusable id", async () => {
    const calls = mockPayPal(tokenResponse, { status: 201, body: { batch_header: { payout_batch_id: "WXEU2FXY2NKXJ", batch_status: "PENDING" } } });
    const { sendPayout } = await load();
    const key = "5b1d7c1e-3f0a-4a7e-9c2b-8d4e6f1a2b3c";
    const res = await sendPayout({ claimId: "RM-0412", payoutKey: key, payerId: "47KT8H23PUJ3Q", amount: { value: "29.99", currency: "USD" }, note: "Refund for recall 27-071" });

    expect(res).toEqual({ batchId: "WXEU2FXY2NKXJ", batchStatus: "PENDING" });
    expect(calls[1].url).toBe("https://api-m.sandbox.paypal.com/v1/payments/payouts");
    expect(calls[1].headers["PayPal-Request-Id"]).toBe(key);
    expect(JSON.parse(calls[1].body!)).toEqual({
      sender_batch_header: { sender_batch_id: key, email_subject: "Your recall refund" },
      items: [{ recipient_type: "PAYPAL_ID", amount: { value: "29.99", currency: "USD" }, receiver: "47KT8H23PUJ3Q", note: "Refund for recall 27-071", sender_item_id: "RM-0412" }],
    });
  });
});

describe("getPayoutStatus", () => {
  it("reads the batch and its one item", async () => {
    const calls = mockPayPal(tokenResponse, {
      body: { batch_header: { payout_batch_id: "B1", batch_status: "SUCCESS" }, items: [{ payout_item_id: "I1", transaction_status: "SUCCESS" }] },
    });
    const { getPayoutStatus } = await load();
    expect(await getPayoutStatus("B1")).toEqual({ batchId: "B1", batchStatus: "SUCCESS", itemId: "I1", itemStatus: "SUCCESS" });
    expect(calls[1]).toMatchObject({ method: "GET", url: "https://api-m.sandbox.paypal.com/v1/payments/payouts/B1" });
  });
});
