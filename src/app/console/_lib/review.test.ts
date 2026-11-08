import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleClaim, sampleRecall } from "@/lib/__fixtures__/claim";
import { PayPalError } from "@/lib/paypal/client";
import { localStore } from "@/lib/store/local";
import type { Store } from "@/lib/store";
import type { Claim } from "@/lib/types";
import { approveClaim, approveConflicts, rejectClaim } from "./review";

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

  it("answers a seeded sample claim's approve without paying or saving", async () => {
    const claim = held({ seeded: true });
    await store.putClaim(claim);
    const pay = vi.fn();
    const result = await approveClaim({ store, claim, recall: sampleRecall(), by: "x", pay });
    expect(result).toMatchObject({ ok: true, claim: { decision: "held" }, sample: expect.stringContaining("Remedy sent nothing") });
    expect(pay).not.toHaveBeenCalled();
    expect(await store.getClaim("RM-0412")).toEqual(claim);
  });

  it("doesn't approve a claim decided between its read and the save", async () => {
    const claim = held();
    await store.putClaim(claim);
    // Another reviewer rejects it while this approve runs its checks.
    const racing: Store = {
      ...store,
      listClaims: async () => {
        await store.putClaim({ ...claim, decision: "rejected" });
        return store.listClaims();
      },
    };
    const pay = vi.fn();

    const result = await approveClaim({ store: racing, claim, recall: sampleRecall(), by: "x", pay });

    expect(result).toMatchObject({ ok: false, status: 409, code: "not_held", message: "This claim is already rejected." });
    expect(pay).not.toHaveBeenCalled();
    expect((await store.getClaim("RM-0412"))?.decision).toBe("rejected");
  });

  it("saves the payout over the claim as it is after PayPal answers, keeping what landed meanwhile", async () => {
    const claim = held();
    await store.putClaim(claim);
    const pay = vi.fn(async () => {
      const now = (await store.getClaim("RM-0412"))!;
      await store.putClaim({ ...now, events: [...now.events, { at: "2026-11-07T10:05:00.000Z", type: "note", detail: "saved while paying" }] });
      return sent;
    });

    await approveClaim({ store, claim, recall: sampleRecall(), by: "x", pay });

    expect((await store.getClaim("RM-0412"))?.events.map((e) => e.type)).toEqual(["created", "approved", "note", "payout_sent"]);
  });

  it("records one payout when two approves race, both sending the same payoutKey", async () => {
    const claim = held();
    await store.putClaim(claim);
    const pay = vi.fn<(input: { payoutKey: string }) => Promise<typeof sent>>(async () => sent);

    const results = await Promise.all([1, 2].map(() => approveClaim({ store, claim, recall: sampleRecall(), by: "x", pay })));

    expect(results.every((r) => r.ok)).toBe(true);
    expect(new Set(pay.mock.calls.map(([input]) => input.payoutKey))).toEqual(new Set([claim.payoutKey]));
    const saved = await store.getClaim("RM-0412");
    expect(saved?.decision).toBe("paid");
    expect(saved?.events.filter((e) => e.type === "payout_sent")).toHaveLength(1);
  });

  it("sends the same payout note as the owner's pipeline", async () => {
    const claim = held({ demo: true });
    await store.putClaim(claim);
    const pay = vi.fn(async () => sent);
    await approveClaim({ store, claim, recall: sampleRecall(), by: "x", pay });
    expect(pay).toHaveBeenCalledWith(expect.objectContaining({ note: "Recall refund for X-VESOLJE Nursing Pillows (CPSC 27-071), claim RM-0412" }));
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
    // The conflict is recorded as a hold after the reason it was first held for, which still leads; a second refused
    // approve doesn't add it twice.
    const payer = { check: "payer", outcome: "hold", text: "This PayPal account already has a claim for this recall (RM-0001)" };
    expect(saved?.reasons.at(-1)).toEqual(payer);
    expect(saved?.reasons[0]).toEqual(claim.reasons[0]);
    await approveClaim({ store, claim, recall: sampleRecall(), by: "x", pay });
    expect((await store.getClaim("RM-0412"))?.reasons.filter((r) => r.check === "payer")).toHaveLength(1);
  });

  it("ignores seeded claims in the re-check", async () => {
    const claim = held();
    await store.putClaim(sampleClaim({ id: "RM-0001", decision: "paid", seeded: true }));
    await store.putClaim(claim);
    expect((await approveClaim({ store, claim, recall: sampleRecall(), by: "x", pay: async () => sent })).ok).toBe(true);
  });

  it("checks a held demo claim only against the same judge's demo claims, as the pipeline did", async () => {
    // Another judge's paid genuine sample: the same sample photo, a different PayPal account.
    await store.putClaim(sampleClaim({ id: "RM-0001", payerId: "OTHERJUDGE001", decision: "paid", demo: true }));
    // A real claim from this judge's account: real claims never meet demo claims.
    await store.putClaim(sampleClaim({ id: "RM-0002", decision: "paid", photos: [{ key: "RM-0002/1.jpg", hash: "fedcba9876543210" }] }));
    const claim = held({ demo: true });
    await store.putClaim(claim);
    const pay = vi.fn(async () => sent);

    const result = await approveClaim({ store, claim, recall: sampleRecall(), by: "x", pay });

    expect(result.ok).toBe(true);
    expect(pay).toHaveBeenCalledOnce();
  });

  it("records the amount paid on the payout", async () => {
    const claim = held();
    await store.putClaim(claim);
    await approveClaim({ store, claim, recall: sampleRecall(), by: "x", pay: async () => sent });
    expect((await store.getClaim("RM-0412"))?.payout?.amount).toEqual(sampleRecall().refund);
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
    expect(saved?.events.at(-1)?.detail).toBe("PayPal didn't take the payout: INSUFFICIENT_FUNDS, debug id dbg-9");
  });

  it("says when Remedy couldn't reach PayPal at all, so nothing left, and never calls it PayPal's answer", async () => {
    const claim = held();
    await store.putClaim(claim);
    const result = await approveClaim({ store, claim, recall: sampleRecall(), by: "x", pay: async () => Promise.reject(new TypeError("fetch failed")) });
    expect(result).toMatchObject({ ok: false, status: 502, message: expect.stringMatching(/^Remedy couldn't reach PayPal\. Nothing was sent/) });
    expect((await store.getClaim("RM-0412"))?.events.at(-1)?.detail).toBe("Remedy couldn't reach PayPal: fetch failed");
  });

  it("forecasts exactly what approve's checks stop: the account's other claim, and nothing once it is rejected", async () => {
    const claim = held();
    const other = sampleClaim({ id: "RM-2584", decision: "paid", photos: [{ key: "b/1.jpg", hash: "fedcba9876543210" }] });
    await store.putClaim(claim);
    await store.putClaim(other);
    const forecast = approveConflicts(claim, await store.listClaims()).map((r) => r.text);
    expect(forecast).toEqual(["This PayPal account already has a claim for this recall (RM-2584)"]);
    const pay = vi.fn(async () => sent);
    const result = await approveClaim({ store, claim, recall: sampleRecall(), by: "x", pay });
    expect(result).toMatchObject({ ok: false, status: 409, code: "send_check" });
    expect(result.ok ? [] : result.reasons?.map((r) => r.text)).toEqual(forecast);
    expect(pay).not.toHaveBeenCalled();
    await store.putClaim({ ...other, decision: "rejected" });
    expect(approveConflicts(claim, await store.listClaims())).toEqual([]);
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

  it("answers a seeded sample claim's reject without saving it", async () => {
    const claim = held({ seeded: true });
    await store.putClaim(claim);
    const result = await rejectClaim({ store, claim, recall: sampleRecall(), by: "x", reason: "The code isn't on the cut pillow" });
    expect(result).toMatchObject({ ok: true, claim: { decision: "held" }, sample: expect.stringContaining("Rejected on review: The code isn't on the cut pillow") });
    expect(await store.getClaim("RM-0412")).toEqual(claim);
    // One closing stop, whether or not the reason brought its own.
    const ended = await rejectClaim({ store, claim, recall: sampleRecall(), by: "x", reason: "Retake photo 2." });
    expect(ended.ok && ended.sample).toMatch(/"Rejected on review: Retake photo 2\."$/);
    expect(result.ok && result.sample).toMatch(/cut pillow\."$/);
  });

  it("leaves a claim decided since the drawer read it, and says how it was decided", async () => {
    const claim = held();
    await store.putClaim({ ...claim, decision: "paid" });
    expect(await rejectClaim({ store, claim, recall: sampleRecall(), by: "x", reason: "too late now" })).toMatchObject({ ok: false, code: "not_held", message: "This claim is already paid." });
    expect((await store.getClaim("RM-0412"))?.decision).toBe("paid");
  });

  it("refuses a claim that isn't held", async () => {
    const claim = sampleClaim({ decision: "paid" });
    await store.putClaim(claim);
    expect(await rejectClaim({ store, claim, recall: sampleRecall(), by: "x", reason: "too late now" })).toMatchObject({ ok: false, code: "not_held" });
  });
});
