import { afterEach, describe, expect, it, vi } from "vitest";
import { verdictOf } from "@/components/console/VerdictMark";
import { approveClaim, rejectClaim } from "@/app/console/_lib/review";
import { demoRecall } from "@/lib/demo/kikea";
import { demoSample, type DemoSampleId } from "@/lib/demo/samples";
import type { Store } from "@/lib/store";
import { summarize, summarizeRecall, type Usage } from "@/lib/store/store";
import { Claim, type Verdict } from "@/lib/types";
import { checkClaim, createClaim, receivePhotos, recoverStale, STALE_AFTER_MS, type PipelineDeps } from "./pipeline";

// These are transient JavaScript test records, never localStore/Blob/a database. Provider dependencies are fakes;
// any accidental network request fails. The persistent-store integration suite remains separate.
function platform() {
  const records: Record<string, Claim> = {};
  const photos: Record<string, Buffer> = {};
  const usage: Record<string, Usage> = {};
  let recall = demoRecall(new Date("2026-11-04T00:00:00Z"));
  let now = new Date("2026-11-11T00:00:00Z");
  const copy = <T>(value: T): T => structuredClone(value);
  const rows = () => Object.values(records).map(summarize);
  const store: Store = {
    async getRecall(id) { return id === recall.id ? copy(recall) : null; },
    async putRecall(next) { recall = copy(next); },
    async listRecalls() { return [summarizeRecall(recall)]; },
    async getClaim(id) { return records[id] ? copy(records[id]) : null; },
    async putClaim(claim) { records[claim.id] = copy(claim); },
    async addClaim(claim, refuse) {
      const refusal = refuse(rows());
      if (refusal) return refusal;
      if (records[claim.id]) throw new Error("Duplicate fixture id");
      records[claim.id] = copy(claim);
      return null;
    },
    async updateClaim(id, change) {
      if (!records[id]) return null;
      const next = change(copy(records[id]));
      if (!next) return null;
      records[id] = copy(next);
      return copy(next);
    },
    async reindexClaim() { return false; },
    async listClaims() { return copy(rows()); },
    async putPhoto(key, bytes) { photos[key] = Buffer.from(bytes); },
    async getPhoto(key) { return photos[key] ? Buffer.from(photos[key]) : null; },
    async getUsage(day) { return copy(usage[day] ?? { vision: 0, draft: 0 }); },
    async takeUsage(day, kind, limit) {
      const counts = usage[day] ??= { vision: 0, draft: 0 };
      if (counts[kind] >= limit) return false;
      counts[kind]++;
      return true;
    },
  };
  const vision = vi.fn(async ({ code }: { code: string }) => {
    const text = code === "K7P" ? "K7Q" : code;
    const verdict: Verdict = {
      label: { text_seen: "X-VESOLJE", matches_recalled_product: "yes", evidence: "The tag reads X-VESOLJE." },
      challenge_code: { text_seen: text, matches: text === code ? "yes" : "no", evidence: `The tag reads ${text}.` },
      steps: recall.spec.proof_steps.map((step) => ({ step, status: "done", evidence: "The required cut is visible." })),
      same_item_in_all_photos: "yes", looks_like_photo_of_screen_or_print: "no", summary: "Fixture evidence",
    };
    return { verdict, seconds: 1.25, model: "fixture-model" };
  });
  const pay = vi.fn<PipelineDeps["pay"]>(async () => ({ batchId: "fixture-batch", batchStatus: "PENDING" }));
  const deps: PipelineDeps = {
    store, vision, pay, now: () => new Date(now),
    hash: async (bytes) => {
      const hash = bytes.toString();
      if (!/^[0-9a-f]{16}$/.test(hash)) throw new Error("Unreadable fixture image");
      return hash;
    },
    limits: { vision: 100, draft: 20, claimsPerDay: 60, claimsPerMonth: 150, accountClaimsPerDay: 5, accountDemosPerDay: 12, demosPerDay: 1000, demosPerMonth: 1000 },
  };
  const owner = { payerId: "FIXTURE-OWNER", verified: true };
  const start = (sample?: DemoSampleId, round = "fixture-round") => createClaim(deps, { recall, payer: owner, ...(sample ? { sample: demoSample(sample)!, round } : {}) });
  const send = (claim: Claim, hash = "0000000000000000", sessionId = claim.captureSession!.id, payerId = owner.payerId) => receivePhotos(deps, { claimId: claim.id, payerId, sessionId, photos: [Buffer.from(hash)] });
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network forbidden in platform contract fixture"); }));
  return { deps, store, vision, pay, start, send, owner, get recall() { return recall; }, advance: (ms: number) => { now = new Date(now.getTime() + ms); } };
}

afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

describe("owner-to-business contracts with no persistence or providers", () => {
  it("walks all four demo inputs through the pipeline; only the eligible one reaches the payout dependency", async () => {
    const p = platform();
    const genuine = await p.start("genuine");
    expect((await p.send(genuine)).decision).toBe("pending");
    const sent = await checkClaim(p.deps, genuine.id);
    expect(Claim.safeParse(sent).success).toBe(true);
    expect(sent.decision).toBe("paid");
    expect(verdictOf(summarize(sent))).toBe("settling");
    expect(p.pay).toHaveBeenCalledExactlyOnceWith({ claimId: genuine.id, payoutKey: genuine.payoutKey, payerId: p.owner.payerId, amount: p.recall.refund, note: expect.stringContaining(genuine.id) });
    expect(sent.events.find((e) => e.type === "checked")?.detail).toContain("fixture-model");

    const wrong = await p.start("wrong-code");
    await p.send(wrong, "ffffffffffffffff");
    const rejected = await checkClaim(p.deps, wrong.id);
    expect(rejected.decision).toBe("rejected");
    expect(rejected.verdict?.challenge_code.text_seen).toBe("K7Q");

    const web = await p.start("ai-no-session");
    expect((await p.send(web, "3333333333333333", "outside-this-session")).decision).toBe("blocked");
    const reposted = await p.start("reposted");
    const blocked = await p.send(reposted);
    expect(blocked.decision).toBe("blocked");
    expect(blocked.reasons.some((r) => r.check === "duplicate_photo")).toBe(true);
    expect(p.vision).toHaveBeenCalledTimes(2);
    expect(p.pay).toHaveBeenCalledOnce();
    expect((await p.store.listClaims()).map((r) => r.decision)).toEqual(["paid", "rejected", "blocked", "blocked"]);

    // A refresh/recheck of a decided claim must not generate a new model answer or payment request.
    await checkClaim(p.deps, genuine.id);
    expect(p.vision).toHaveBeenCalledTimes(2);
    expect(p.pay).toHaveBeenCalledOnce();
  });

  it.each(["expired", "wrong-owner", "unverified"] as const)("rejects the %s boundary before a model/payment call", async (boundary) => {
    const p = platform();
    const claim = await p.start();
    if (boundary === "expired") p.advance(11 * 60_000);
    if (boundary === "unverified") await p.store.putClaim({ ...claim, payerVerified: false });
    if (boundary === "wrong-owner") {
      await expect(p.send(claim, undefined, undefined, "ANOTHER-OWNER")).rejects.toMatchObject({ status: 404 });
      expect((await p.store.getClaim(claim.id))?.photos).toEqual([]);
    } else {
      expect((await p.send(claim)).decision).toBe("blocked");
    }
    expect(p.vision).not.toHaveBeenCalled();
    expect(p.pay).not.toHaveBeenCalled();
  });

  it.each(["model-failed", "budget-reached", "worker-stale", "payout-failed", "auto-pay-off"] as const)("preserves photos and hands %s to review without claiming a confirmed payout", async (failure) => {
    const p = platform();
    if (failure === "auto-pay-off") await p.store.putRecall({ ...p.recall, autoPay: false });
    if (failure === "model-failed") p.vision.mockRejectedValue(new Error("Synthetic model failure"));
    if (failure === "payout-failed") p.pay.mockRejectedValue(new Error("Synthetic payout failure"));
    if (failure === "budget-reached") p.deps.limits.vision = 0;
    const claim = await p.start();
    const received = await p.send(claim);
    if (failure === "worker-stale") p.advance(STALE_AFTER_MS + 1);
    const result = failure === "worker-stale" ? await recoverStale(p.deps, received) : await checkClaim(p.deps, claim.id);
    expect(result.decision).toBe("held");
    expect(result.photos).toHaveLength(1);
    expect(result.payout).toBeNull();
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(verdictOf(summarize(result))).toBe("held");
    if (failure !== "payout-failed") expect(p.pay).not.toHaveBeenCalled();
    if (failure === "budget-reached" || failure === "worker-stale") expect(p.vision).not.toHaveBeenCalled();
  });

  it("keeps demo rounds separate without rejecting a new judge's eligible sample", async () => {
    const p = platform();
    const first = await p.start("genuine", "round-one");
    await p.send(first);
    await checkClaim(p.deps, first.id);
    const second = await p.start("genuine", "round-two");
    expect((await p.send(second)).decision).toBe("pending");
    await checkClaim(p.deps, second.id);
    expect(p.vision).toHaveBeenCalledTimes(2);
    expect(p.pay).toHaveBeenCalledTimes(2);
    const repeated = await p.start("genuine", "round-two");
    expect((await p.send(repeated)).decision).toBe("blocked");
    expect(p.pay).toHaveBeenCalledTimes(2);
  });

  it("never uses seeded or demo records to block or answer a real owner's claim", async () => {
    const p = platform();
    const illustrated = await p.start();
    await p.store.putClaim({ ...illustrated, seeded: true, decision: "paid", photos: [{ key: "fixture-seed", hash: "0000000000000000" }] });
    const demo = await p.start("genuine");
    await p.store.putClaim({ ...demo, decision: "paid", photos: [{ key: "fixture-demo", hash: "0000000000000000" }] });
    const owner = await p.start();
    expect((await p.send(owner)).decision).toBe("pending");
    const checked = await checkClaim(p.deps, owner.id);
    expect(checked.decision).toBe("paid");
    expect(checked.verdict?.challenge_code.text_seen).toBe(owner.code);
    expect(p.vision).toHaveBeenCalledOnce();
    expect(p.pay).toHaveBeenCalledOnce();
  });

  it.each(["approve", "reject"] as const)("lets a business %s a held claim and records the decision without repeating it", async (action) => {
    const p = platform();
    await p.store.putRecall({ ...p.recall, autoPay: false });
    const claim = await p.start();
    await p.send(claim);
    const held = await checkClaim(p.deps, claim.id);
    expect(held.decision).toBe("held");
    const input = { store: p.store, claim: held, recall: p.recall, by: "Fixture recall operator" };
    const result = action === "approve"
      ? await approveClaim({ ...input, pay: p.pay })
      : await rejectClaim({ ...input, reason: "The cut is not visible in the submitted photograph." });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected a fixture decision");
    expect(result.claim.decision).toBe(action === "approve" ? "paid" : "rejected");
    expect(result.claim.photos).toEqual(held.photos);
    if (action === "approve") {
      expect(verdictOf(summarize(result.claim))).toBe("settling");
      expect(p.pay).toHaveBeenCalledOnce();
      expect((await approveClaim({ ...input, pay: p.pay })).ok).toBe(false);
      expect(p.pay).toHaveBeenCalledOnce();
    } else {
      expect(result.claim.reasons.some((r) => r.check === "review" && r.outcome === "reject")).toBe(true);
      expect(p.pay).not.toHaveBeenCalled();
      expect((await rejectClaim({ ...input, reason: "Repeated decision" })).ok).toBe(false);
    }
  });

  it("keeps failed business approval held, then reuses the same payout key for a deliberate retry", async () => {
    const p = platform();
    await p.store.putRecall({ ...p.recall, autoPay: false });
    const claim = await p.start();
    await p.send(claim);
    const held = await checkClaim(p.deps, claim.id);
    const input = { store: p.store, claim: held, recall: p.recall, by: "Fixture operator", pay: p.pay };
    p.pay.mockRejectedValueOnce(new Error("Synthetic lost provider reply"));
    expect(await approveClaim(input)).toMatchObject({ ok: false, code: "paypal", status: 502 });
    expect((await p.store.getClaim(claim.id))?.decision).toBe("held");
    expect((await approveClaim(input)).ok).toBe(true);
    expect(p.pay.mock.calls.map(([sent]) => sent.payoutKey)).toEqual([claim.payoutKey, claim.payoutKey]);
  });
});
