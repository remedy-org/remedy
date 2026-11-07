import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { countingStore } from "../__fixtures__/counting";
import { sampleClaim } from "../__fixtures__/claim";
import { localStore } from "../store/local";
import type { Store } from "../store";
import type { Claim, Payout } from "../types";
import { applyPayoutStatus, refreshPayouts, savePayoutStatus } from "./status";

let dir: string;
let store: Store;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "remedy-status-"));
  store = localStore(dir);
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const paid = (payout: Partial<Payout> = {}, over: Partial<Claim> = {}) =>
  sampleClaim({ decision: "paid", payout: { batchId: "E3VTQ6BPYAA6U", status: "PENDING", updatedAt: "2026-11-07T10:01:00.000Z", ...payout }, ...over });
const later = new Date("2026-11-07T10:05:00.000Z");
const earlier = new Date("2026-11-07T10:00:30.000Z");

describe("applyPayoutStatus", () => {
  it("moves a settling payout to PayPal's status and records it", () => {
    const next = applyPayoutStatus(paid(), { status: "SUCCESS", itemId: "ITEM1", at: later });
    expect(next?.payout).toMatchObject({ batchId: "E3VTQ6BPYAA6U", itemId: "ITEM1", status: "SUCCESS", updatedAt: later.toISOString() });
    expect(next?.events.at(-1)).toEqual({ at: later.toISOString(), type: "payout_updated", detail: "PayPal: SUCCESS" });
  });

  it("changes nothing for a duplicate", () => {
    expect(applyPayoutStatus(paid({ status: "SUCCESS" }), { status: "SUCCESS", at: later })).toBeNull();
  });

  it("never moves a terminal status back to settling, even when the report is newer", () => {
    for (const status of ["SUCCESS", "FAILED", "RETURNED", "BLOCKED", "DENIED"]) {
      expect(applyPayoutStatus(paid({ status }), { status: "PENDING", at: later })).toBeNull();
      expect(applyPayoutStatus(paid({ status }), { status: "UNCLAIMED", at: later })).toBeNull();
    }
    expect(applyPayoutStatus(paid({ status: "FAILED" }), { status: "SUCCESS", at: later })).toBeNull();
  });

  it("lets a sent payout be refunded or reversed, and nothing after that", () => {
    expect(applyPayoutStatus(paid({ status: "SUCCESS" }), { status: "REVERSED", at: later })?.payout?.status).toBe("REVERSED");
    expect(applyPayoutStatus(paid({ status: "SUCCESS" }), { status: "REFUNDED", at: later })?.payout?.status).toBe("REFUNDED");
    expect(applyPayoutStatus(paid({ status: "REVERSED" }), { status: "SUCCESS", at: later })).toBeNull();
  });

  it("ignores a settling status older than the stored one, but a terminal one always lands", () => {
    expect(applyPayoutStatus(paid({ status: "UNCLAIMED" }), { status: "PENDING", at: earlier })).toBeNull();
    const next = applyPayoutStatus(paid({ status: "UNCLAIMED" }), { status: "SUCCESS", at: earlier });
    expect(next?.payout?.status).toBe("SUCCESS");
    // The stored time never goes backwards, so a later stale event is still caught.
    expect(next?.payout?.updatedAt).toBe("2026-11-07T10:01:00.000Z");
  });

  it("skips seeded claims and claims with no payout", () => {
    expect(applyPayoutStatus(paid({ batchId: "SEEDABCDEFGHJ" }), { status: "SUCCESS", at: later })).toBeNull();
    expect(applyPayoutStatus(paid({}, { seeded: true }), { status: "SUCCESS", at: later })).toBeNull();
    expect(applyPayoutStatus(sampleClaim({ decision: "held" }), { status: "SUCCESS", at: later })).toBeNull();
  });

  it("keeps a known item id", () => {
    expect(applyPayoutStatus(paid({ itemId: "ITEM1" }), { status: "SUCCESS", itemId: "OTHER", at: later })?.payout?.itemId).toBe("ITEM1");
  });
});

describe("savePayoutStatus", () => {
  it("saves the new status to the claim and the index", async () => {
    await store.putClaim(paid());
    expect((await savePayoutStatus(store, "RM-0412", "E3VTQ6BPYAA6U", { status: "SUCCESS", at: later }))?.payout?.status).toBe("SUCCESS");
    expect((await store.getClaim("RM-0412"))?.payout?.status).toBe("SUCCESS");
    expect((await store.listClaims())[0].payoutStatus).toBe("SUCCESS");
  });

  it("is idempotent: a repeat writes nothing", async () => {
    await store.putClaim(paid());
    await savePayoutStatus(store, "RM-0412", "E3VTQ6BPYAA6U", { status: "SUCCESS", at: later });
    expect(await savePayoutStatus(store, "RM-0412", "E3VTQ6BPYAA6U", { status: "SUCCESS", at: later })).toBeNull();
    expect((await store.getClaim("RM-0412"))?.events.filter((e) => e.type === "payout_updated")).toHaveLength(1);
  });

  it("leaves a claim paid by another batch, or a missing claim, alone", async () => {
    await store.putClaim(paid());
    expect(await savePayoutStatus(store, "RM-0412", "OTHERBATCH", { status: "SUCCESS", at: later })).toBeNull();
    expect(await savePayoutStatus(store, "RM-0999", "E3VTQ6BPYAA6U", { status: "SUCCESS", at: later })).toBeNull();
    expect((await store.getClaim("RM-0412"))?.payout?.status).toBe("PENDING");
  });

  it("keeps a terminal status another save wrote while this one was reading", async () => {
    await store.putClaim(paid());
    // The webhook's SUCCESS and a console check's UNCLAIMED, both read from the same PENDING claim.
    const [webhook, refresh] = await Promise.all([
      savePayoutStatus(store, "RM-0412", "E3VTQ6BPYAA6U", { status: "SUCCESS", at: later }),
      savePayoutStatus(store, "RM-0412", "E3VTQ6BPYAA6U", { status: "UNCLAIMED", at: later }),
    ]);
    expect([webhook?.payout?.status, refresh]).toEqual(["SUCCESS", null]);
    const claim = await store.getClaim("RM-0412");
    expect(claim?.payout?.status).toBe("SUCCESS");
    expect(claim?.events.filter((e) => e.type === "payout_updated").map((e) => e.detail)).toEqual(["PayPal: SUCCESS"]);
    expect((await store.listClaims())[0].payoutStatus).toBe("SUCCESS");
  });
});

describe("refreshPayouts", () => {
  const status = (batchId: string, itemStatus?: string) => ({ batchId, batchStatus: "SUCCESS", itemId: `I-${batchId}`, itemStatus });

  it("asks PayPal about settling payouts only, and saves what moved", async () => {
    const claims = [
      paid({ batchId: "B1" }, { id: "RM-0001" }),
      paid({ batchId: "B2", status: "SUCCESS" }, { id: "RM-0002" }),
      paid({ batchId: "SEEDXXXXXXXXX" }, { id: "RM-0003", seeded: true }),
      sampleClaim({ id: "RM-0004", decision: "held" }),
      paid({ batchId: "B5", status: "UNCLAIMED" }, { id: "RM-0005", demo: true }),
    ];
    for (const c of claims) await store.putClaim(c);
    const check = vi.fn(async (batchId: string) => status(batchId, batchId === "B1" ? "SUCCESS" : "UNCLAIMED"));

    const out = await refreshPayouts(store, claims, { check, now: () => later });

    expect(check.mock.calls.map(([b]) => b)).toEqual(["B1", "B5"]);
    expect(out.map((c) => c.payout?.status ?? null)).toEqual(["SUCCESS", "SUCCESS", "PENDING", null, "UNCLAIMED"]);
    expect((await store.getClaim("RM-0001"))?.payout).toMatchObject({ status: "SUCCESS", itemId: "I-B1" });
    expect((await store.getClaim("RM-0005"))?.events.some((e) => e.type === "payout_updated")).toBe(false);
  });

  it("dates each check by when PayPal answered, so a webhook saved meanwhile isn't replaced", async () => {
    const claims = [paid({ batchId: "B1" }, { id: "RM-0001" }), paid({ batchId: "B2" }, { id: "RM-0002" })];
    for (const c of claims) await store.putClaim(c);
    let clock = new Date("2026-11-07T10:02:00.000Z");
    const check = vi.fn(async (batchId: string) => {
      if (batchId === "B2") {
        // While B2's check is out, a webhook for B1 lands at 10:03, and the save comes later still.
        await savePayoutStatus(store, "RM-0001", "B1", { status: "ONHOLD", at: new Date("2026-11-07T10:03:00.000Z") });
        clock = new Date("2026-11-07T10:04:00.000Z");
      }
      return status(batchId, "UNCLAIMED");
    });

    await refreshPayouts(store, claims, { check, now: () => clock });

    expect((await store.getClaim("RM-0001"))?.payout).toMatchObject({ status: "ONHOLD", updatedAt: "2026-11-07T10:03:00.000Z" });
    expect((await store.getClaim("RM-0002"))?.payout).toMatchObject({ status: "UNCLAIMED", updatedAt: "2026-11-07T10:04:00.000Z" });
  });

  it("doesn't read a claim again when PayPal's status hasn't moved", async () => {
    const claims = [paid({ batchId: "B1" }, { id: "RM-0001" })];
    for (const c of claims) await store.putClaim(c);
    const counter = countingStore(store);
    const out = await refreshPayouts(counter.store, claims, { check: async (batchId) => status(batchId, "PENDING") });
    expect(out).toEqual(claims);
    expect(counter.counts).toMatchObject({ reads: 0, writes: 0 });
  });

  it("checks at most `limit` claims", async () => {
    const claims = Array.from({ length: 15 }, (_, i) => paid({ batchId: `B${i}` }, { id: `RM-${String(i + 1).padStart(4, "0")}` }));
    const check = vi.fn(async (batchId: string) => status(batchId, "PENDING"));
    await refreshPayouts(store, claims, { check });
    expect(check).toHaveBeenCalledTimes(10);
  });

  it("keeps the stored status when PayPal fails or is too slow", async () => {
    const claims = [paid({ batchId: "B1" }, { id: "RM-0001" }), paid({ batchId: "B2" }, { id: "RM-0002" })];
    for (const c of claims) await store.putClaim(c);
    const check = vi.fn((batchId: string) => (batchId === "B1" ? Promise.reject(new Error("down")) : new Promise<never>(() => {})));

    const out = await refreshPayouts(store, claims, { check, timeoutMs: 20 });

    expect(out).toEqual(claims);
    expect((await store.getClaim("RM-0001"))?.payout?.status).toBe("PENDING");
  });
});
