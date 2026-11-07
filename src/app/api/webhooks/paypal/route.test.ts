import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleClaim } from "@/lib/__fixtures__/claim";
import { mockPayPal, tokenResponse } from "@/lib/paypal/test-helpers";
import { localStore } from "@/lib/store/local";
import type { Store } from "@/lib/store";

let dir: string;
let store: Store;
vi.mock("@/lib/demo", () => ({ getAppStore: async () => store }));

beforeEach(async () => {
  vi.resetModules();
  dir = await mkdtemp(join(tmpdir(), "remedy-webhook-"));
  store = localStore(dir);
  await store.putClaim(sampleClaim({ decision: "paid", payout: { batchId: "E3VTQ6BPYAA6U", status: "PENDING", updatedAt: "2026-11-07T10:01:00.000Z" } }));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const event = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    id: "WH-EVT-1",
    create_time: "2026-11-07T10:02:00.000Z",
    event_type: "PAYMENT.PAYOUTS-ITEM.SUCCEEDED",
    resource: { payout_item_id: "ITEM1", payout_batch_id: "E3VTQ6BPYAA6U", transaction_status: "SUCCESS", payout_item: { sender_item_id: "RM-0412" } },
    ...over,
  });

const signed = {
  "paypal-auth-algo": "SHA256withRSA",
  "paypal-cert-url": "https://api.sandbox.paypal.com/v1/notifications/certs/CERT",
  "paypal-transmission-id": "tid",
  "paypal-transmission-sig": "sig",
  "paypal-transmission-time": "2026-11-07T10:02:00Z",
};
const post = async (body: string) => {
  const { POST } = await import("./route");
  return POST(new Request("http://127.0.0.1:3000/api/webhooks/paypal", { method: "POST", headers: signed, body }));
};
// The app token is fetched once, then each event is one verification call.
const verifies = (status: "SUCCESS" | "FAILURE", times = 1) => mockPayPal(tokenResponse, ...Array.from({ length: times }, () => ({ body: { verification_status: status } })));

describe("POST /api/webhooks/paypal", () => {
  it("updates the claim's payout once PayPal verifies the event", async () => {
    const calls = verifies("SUCCESS");
    const res = await post(event());
    expect(res.status).toBe(200);
    expect(calls[1].body).toContain(`"webhook_event":${event()}}`);
    expect((await store.getClaim("RM-0412"))?.payout).toMatchObject({ status: "SUCCESS", itemId: "ITEM1" });
  });

  it("refuses an event whose signature fails, and changes nothing", async () => {
    verifies("FAILURE");
    expect((await post(event())).status).toBe(400);
    expect((await store.getClaim("RM-0412"))?.payout?.status).toBe("PENDING");
  });

  it("refuses everything when PAYPAL_WEBHOOK_ID is unset, logging once", async () => {
    mockPayPal();
    vi.stubEnv("PAYPAL_WEBHOOK_ID", "");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await post(event())).status).toBe(503);
    expect((await post(event())).status).toBe(503);
    expect(log).toHaveBeenCalledTimes(1);
    expect((await store.getClaim("RM-0412"))?.payout?.status).toBe("PENDING");
  });

  it("answers 200 to other events and to events for another store's claim", async () => {
    verifies("SUCCESS", 2);
    expect((await post(event({ event_type: "PAYMENT.PAYOUTSBATCH.SUCCESS" }))).status).toBe(200);
    const other = event({ resource: { payout_item_id: "I9", payout_batch_id: "OTHERBATCH", transaction_status: "FAILED", payout_item: { sender_item_id: "RM-0412" } } });
    expect((await post(other)).status).toBe(200);
    expect((await store.getClaim("RM-0412"))?.payout?.status).toBe("PENDING");
  });

  it("ignores a retried duplicate and a stale settling event", async () => {
    verifies("SUCCESS", 3);
    await post(event());
    expect(await (await post(event())).json()).toEqual({ updated: false });
    const stale = event({ id: "WH-EVT-0", create_time: "2026-11-07T10:00:00.000Z", event_type: "PAYMENT.PAYOUTS-ITEM.UNCLAIMED", resource: { payout_item_id: "ITEM1", payout_batch_id: "E3VTQ6BPYAA6U", transaction_status: "UNCLAIMED", payout_item: { sender_item_id: "RM-0412" } } });
    expect(await (await post(stale)).json()).toEqual({ updated: false });
    const claim = await store.getClaim("RM-0412");
    expect(claim?.payout?.status).toBe("SUCCESS");
    expect(claim?.events.filter((e) => e.type === "payout_updated")).toHaveLength(1);
  });

  it("dates a settling event by its create_time, not by when it arrived", async () => {
    await store.putClaim(sampleClaim({ decision: "paid", payout: { batchId: "E3VTQ6BPYAA6U", status: "UNCLAIMED", updatedAt: "2026-11-07T10:01:00.000Z" } }));
    verifies("SUCCESS", 2);
    const pending = (id: string, create_time: string) =>
      event({ id, create_time, event_type: "PAYMENT.PAYOUTS-ITEM.HELD", resource: { payout_item_id: "ITEM1", payout_batch_id: "E3VTQ6BPYAA6U", transaction_status: "PENDING", payout_item: { sender_item_id: "RM-0412" } } });
    expect(await (await post(pending("WH-EVT-0", "2026-11-07T10:00:00.000Z"))).json()).toEqual({ updated: false });
    expect((await store.getClaim("RM-0412"))?.payout?.status).toBe("UNCLAIMED");
    expect(await (await post(pending("WH-EVT-2", "2026-11-07T10:03:00.000Z"))).json()).toEqual({ updated: true });
    expect((await store.getClaim("RM-0412"))?.payout).toMatchObject({ status: "PENDING", updatedAt: "2026-11-07T10:03:00.000Z" });
  });
});
