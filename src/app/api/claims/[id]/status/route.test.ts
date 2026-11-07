import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleClaim, sampleRecall } from "@/lib/__fixtures__/claim";
import type { Session } from "@/lib/session";
import type { Store } from "@/lib/store";
import { localStore } from "@/lib/store/local";

// GET /api/claims/<id>/status: what the camera step and the paid receipt poll. Owner only, never cached, and the payout
// status PayPal last gave, saved when it moves.

vi.mock("server-only", () => ({}));
let store: Store;
vi.mock("@/lib/demo", async (original) => ({ ...(await original<typeof import("@/lib/demo")>()), getAppStore: async () => store }));
let session: Session | null;
vi.mock("@/lib/session", async (original) => ({ ...(await original<typeof import("@/lib/session")>()), getSession: async () => session }));
const getPayoutStatus = vi.hoisted(() => vi.fn(async (batchId: string) => ({ batchId, batchStatus: "PENDING", itemStatus: "PENDING" })));
vi.mock("@/lib/paypal/payouts", () => ({ getPayoutStatus, sendPayout: vi.fn() }));

const { GET } = await import("./route");

const OWNER = "47KT8H23PUJ3Q";
const poll = (id: string) => GET(new Request(`http://127.0.0.1:3000/api/claims/${id}/status`) as never, { params: Promise.resolve({ id }) });
const paid = (id: string, payerId = OWNER) =>
  sampleClaim({ id, payerId, decision: "paid", payout: { batchId: `LIVE${id.slice(3)}`, status: "PENDING", updatedAt: "2026-11-07T10:01:00.000Z" } });

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "remedy-status-"));
  store = localStore(dir);
  await store.putRecall(sampleRecall());
  session = { role: "owner", payerId: OWNER, verified: true, name: null, email: null, iat: 0 };
  getPayoutStatus.mockClear();
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("GET /api/claims/[id]/status", () => {
  it("is 401 without an owner session, before any read", async () => {
    session = null;
    await store.putClaim(paid("RM-0701"));
    const res = await poll("RM-0701");
    expect(res.status).toBe(401);
    expect(JSON.stringify(await res.json())).not.toContain("PENDING");
    expect(getPayoutStatus).not.toHaveBeenCalled();
  });

  it("is 404 for another owner's claim, and for no claim at all", async () => {
    await store.putClaim(paid("RM-0702", "SOMEONEELSE1"));
    expect((await poll("RM-0702")).status).toBe(404);
    expect((await poll("RM-9999")).status).toBe(404);
    expect(getPayoutStatus).not.toHaveBeenCalled();
  });

  it("answers the owner with no-store: the decision, the photo count, and no payout field before there is one", async () => {
    await store.putClaim(sampleClaim({ id: "RM-0703", payerId: OWNER, photos: [] }));
    const res = await poll("RM-0703");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ decision: "pending", photos: 0 });
  });

  it("carries the payout status, and saves PayPal's new one when it moves", async () => {
    await store.putClaim(paid("RM-0704"));
    getPayoutStatus.mockResolvedValueOnce({ batchId: "LIVE0704", batchStatus: "SUCCESS", itemStatus: "SUCCESS" });
    const res = await poll("RM-0704");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ decision: "paid", payout: "SUCCESS" });
    expect((await store.getClaim("RM-0704"))?.payout?.status).toBe("SUCCESS");

    // Settled: the next poll answers from the claim alone.
    getPayoutStatus.mockClear();
    expect(await (await poll("RM-0704")).json()).toMatchObject({ payout: "SUCCESS" });
    expect(getPayoutStatus).not.toHaveBeenCalled();
  });
});
