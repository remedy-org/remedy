import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleClaim, sampleRecall } from "@/lib/__fixtures__/claim";
import { PayPalError } from "@/lib/paypal/client";
import { localStore } from "@/lib/store/local";
import type { Store } from "@/lib/store";
import type { Claim } from "@/lib/types";
import { approveClaim, rejectClaim } from "./review";

let dir: string;
let store: Store;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "remedy-review-"));
  store = localStore(dir);
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const held = (over: Partial<Claim> = {}) => sampleClaim({ decision: "held", reasons: [{ check: "same_item", outcome: "hold", text: "Couldn't tell" }], ...over });
const sent = { batchId: "BATCH1", batchStatus: "PENDING" };

describe("approveClaim", () => {
  it("re-checks, pays with the claim's payoutKey and records the payout", async () => {
    const claim = held();
    await store.putClaim(claim);
    const pay = vi.fn(async () => sent);

    const result = await approveClaim({ store, claim, recall: sampleRecall(), by: "Kikea Store", pay });

    expect(result.ok).toBe(true);
    expect(pay).toHaveBeenCalledWith(expect.objectContaining({ claimId: "RM-0412", payoutKey: claim.payoutKey, payerId: claim.payerId, amount: sampleRecall().refund }));
    const saved = await store.getClaim("RM-0412");
    expect(saved?.decision).toBe("paid");
    expect(saved?.payout).toMatchObject({ batchId: "BATCH1", status: "PENDING" });
    expect(saved?.events.map((e) => e.type)).toEqual(["created", "approved", "payout_sent"]);
    expect((await store.listClaims())[0].decision).toBe("paid");
  });

  it("refuses a claim that is no longer held, reading the stored copy", async () => {
    await store.putClaim(held({ decision: "paid" }));
    const pay = vi.fn();
    const result = await approveClaim({ store, claim: held(), recall: sampleRecall(), by: "x", pay });
    expect(result).toMatchObject({ ok: false, status: 409, code: "not_held" });
    expect(pay).not.toHaveBeenCalled();
  });

  it("never pays a seeded sample claim", async () => {
    const claim = held({ seeded: true });
    await store.putClaim(claim);
    const pay = vi.fn();
    expect(await approveClaim({ store, claim, recall: sampleRecall(), by: "x", pay })).toMatchObject({ ok: false, code: "seeded" });
    expect(pay).not.toHaveBeenCalled();
  });

  it("holds instead of paying when sendCheck finds another live claim from the account", async () => {
    const claim = held();
    await store.putClaim(sampleClaim({ id: "RM-0001", decision: "paid", photos: [{ key: "RM-0001/1.jpg", hash: "fedcba9876543210" }] }));
    await store.putClaim(claim);
    const pay = vi.fn();

    const result = await approveClaim({ store, claim, recall: sampleRecall(), by: "x", pay });

    expect(result).toMatchObject({ ok: false, code: "send_check" });
    expect(pay).not.toHaveBeenCalled();
    const saved = await store.getClaim("RM-0412");
    expect(saved?.decision).toBe("held");
    expect(saved?.events.at(-1)?.type).toBe("approve_refused");
  });

  it("ignores seeded claims in the re-check", async () => {
    const claim = held();
    await store.putClaim(sampleClaim({ id: "RM-0001", decision: "paid", seeded: true }));
    await store.putClaim(claim);
    expect((await approveClaim({ store, claim, recall: sampleRecall(), by: "x", pay: async () => sent })).ok).toBe(true);
  });

  it("keeps the claim held, with PayPal's debug id, when the payout fails", async () => {
    const claim = held();
    await store.putClaim(claim);
    const pay = vi.fn(async () => {
      throw new PayPalError("POST /v1/payments/payouts -> 422 INSUFFICIENT_FUNDS", 422, "INSUFFICIENT_FUNDS", "dbg-9", null);
    });

    const result = await approveClaim({ store, claim, recall: sampleRecall(), by: "x", pay });

    expect(result).toMatchObject({ ok: false, status: 502, code: "paypal", reference: "dbg-9" });
    const saved = await store.getClaim("RM-0412");
    expect(saved?.decision).toBe("held");
    expect(saved?.payout).toBeNull();
    expect(saved?.events.map((e) => e.type)).toEqual(["created", "approved", "payout_failed"]);
  });
});

describe("rejectClaim", () => {
  it("rejects a held claim with the reviewer's reason", async () => {
    const claim = held();
    await store.putClaim(claim);
    const result = await rejectClaim({ store, claim, recall: sampleRecall(), by: "Kikea Store", reason: "The code isn't on the cut pillow" });
    expect(result.ok).toBe(true);
    const saved = await store.getClaim("RM-0412");
    expect(saved?.decision).toBe("rejected");
    expect(saved?.reasons.at(-1)).toEqual({ check: "review", outcome: "reject", text: "Rejected on review: The code isn't on the cut pillow" });
  });

  it("refuses a claim that isn't held", async () => {
    const claim = sampleClaim({ decision: "paid" });
    await store.putClaim(claim);
    expect(await rejectClaim({ store, claim, recall: sampleRecall(), by: "x", reason: "too late now" })).toMatchObject({ ok: false, code: "not_held" });
  });
});
