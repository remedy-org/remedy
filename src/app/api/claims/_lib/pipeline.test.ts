import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRows } from "@/components/claim/model";
import { CODE_PATTERN } from "@/lib/codes";
import { DEMO_SPEC, demoRecall, demoSample } from "@/lib/demo";
import { PayPalError } from "@/lib/paypal/client";
import type { Store } from "@/lib/store";
import { localStore } from "@/lib/store/local";
import type { Claim, Recall, Verdict } from "@/lib/types";
import { checkClaim, ClaimError, createClaim, findOpenClaim, LIMIT_HOLD, LimitReached, othersFor, receivePhotos, recoverStale, STALE_AFTER_MS, type PipelineDeps } from "./pipeline";

// Claim ids in order, so starts that race on one index snapshot never draw the same random id.
vi.mock("@/lib/ids", async (importOriginal) => {
  const ids = await importOriginal<typeof import("@/lib/ids")>();
  let n = 0;
  return {
    ...ids,
    newClaimId: (taken: ReadonlySet<string>) => {
      let id;
      do id = `RM-${String(++n).padStart(4, "0")}`;
      while (taken.has(id));
      return id;
    },
  };
});

const T0 = new Date("2026-11-07T10:00:00.000Z");

function verdict(over: { label?: "yes" | "no" | "unclear"; code?: string | null; matches?: "yes" | "no" | "unclear"; steps?: ("done" | "not_done" | "unclear")[] } = {}): Verdict {
  return {
    label: { text_seen: "X-VESOLJE", matches_recalled_product: over.label ?? "yes", evidence: "Tag reads X-VESOLJE in marker" },
    steps: (over.steps ?? ["done", "done"]).map((status, i) => ({ step: DEMO_SPEC.proof_steps[i], status, evidence: `step ${i + 1} evidence` })),
    challenge_code: { text_seen: over.code === undefined ? "M4T" : over.code, matches: over.matches ?? "yes", evidence: "Tag reads M4T" },
    same_item_in_all_photos: "yes",
    looks_like_photo_of_screen_or_print: "no",
    summary: "A cut pillow with a tag",
  };
}

// Distinct 64-bit hashes per photo: the photo bytes are the hash, so tests choose which photos collide.
const photo = (hex: string) => Buffer.from(hex);

let dir: string;
let store: Store;
let recall: Recall;
let clock: Date;
let deps: PipelineDeps & { vision: ReturnType<typeof vi.fn>; pay: ReturnType<typeof vi.fn> };

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "remedy-pipeline-"));
  store = localStore(dir);
  recall = demoRecall(new Date("2026-11-04T00:00:00Z"));
  await store.putRecall(recall);
  clock = T0;
  deps = {
    store,
    now: () => clock,
    hash: async (b: Buffer) => {
      const hex = b.toString();
      if (!/^[0-9a-f]{16}$/.test(hex)) throw new Error("not an image");
      return hex;
    },
    vision: vi.fn(async () => ({ verdict: verdict(), seconds: 12.3, model: "gpt-test" })),
    pay: vi.fn(async () => ({ batchId: "BATCH1", batchStatus: "PENDING" })),
    limits: { vision: 100, draft: 20, claimsPerDay: 60, claimsPerMonth: 150, accountClaimsPerDay: 5, accountDemosPerDay: 12 },
  };
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const owner = { payerId: "OWNER0000001", verified: true };

async function open(code = "M4T", over: Partial<Claim> = {}) {
  const claim = await createClaim(deps, { recall, payer: owner });
  const fixed = { ...claim, code, ...over };
  await store.putClaim(fixed);
  return fixed;
}

const send = (claim: Claim, photos = [photo("00000000000000ff")], sessionId = claim.captureSession!.id) =>
  receivePhotos(deps, { claimId: claim.id, payerId: claim.payerId, sessionId, photos });

describe("createClaim", () => {
  it("issues a code and a 10-minute camera session, and saves the claim", async () => {
    const claim = await createClaim(deps, { recall, payer: owner });
    expect(claim.code).toMatch(CODE_PATTERN);
    expect(Date.parse(claim.captureSession!.expiresAt) - T0.getTime()).toBe(10 * 60_000);
    expect(claim.decision).toBe("pending");
    expect(claim.demo).toBeUndefined();
    expect(await store.getClaim(claim.id)).toEqual(claim);
  });

  it("takes a demo claim's code from its sample and records the sample", async () => {
    const claim = await createClaim(deps, { recall, payer: owner, sample: demoSample("wrong-code")! });
    expect(claim.code).toBe("K7P");
    expect(claim.demo).toBe(true);
    expect(claim.events.find((e) => e.type === "demo_sample")?.detail).toBe("wrong-code");
  });
});

describe("createClaim limits", () => {
  it("refuses a start past the account's daily limit, saving nothing, and starts again the next UTC day", async () => {
    deps.limits.accountClaimsPerDay = 2;
    await createClaim(deps, { recall, payer: owner });
    await createClaim(deps, { recall, payer: owner });
    const refused = await createClaim(deps, { recall, payer: owner }).catch((e: unknown) => e);
    expect(refused).toBeInstanceOf(LimitReached);
    expect((refused as LimitReached).refusal).toEqual({ kind: "account", limit: 2, until: new Date("2026-11-08T00:00:00.000Z") });
    expect(await store.listClaims()).toHaveLength(2);
    // Another account, and demo claims from this one, are counted apart.
    await createClaim(deps, { recall, payer: { payerId: "OWNER0000002", verified: true } });
    await createClaim(deps, { recall, payer: owner, sample: demoSample("genuine")! });
    clock = new Date("2026-11-08T00:00:01.000Z");
    expect((await createClaim(deps, { recall, payer: owner })).decision).toBe("pending");
  });

  it("holds the limit when starts race, saving only the ones that fit", async () => {
    deps.limits.accountDemosPerDay = 3;
    const started = await Promise.allSettled(Array.from({ length: 8 }, () => createClaim(deps, { recall, payer: owner, sample: demoSample("genuine")! })));
    expect(started.filter((s) => s.status === "fulfilled")).toHaveLength(3);
    expect(started.filter((s) => s.status === "rejected").every((s) => s.reason instanceof LimitReached)).toBe(true);
    expect(await store.listClaims()).toHaveLength(3);
  });

  it("refuses a demo start once today's photo checks are used up, but still starts a real claim", async () => {
    deps.limits.vision = 1;
    expect(await store.takeUsage("2026-11-07", "vision", 1)).toBe(true);
    await expect(createClaim(deps, { recall, payer: owner, sample: demoSample("genuine")! })).rejects.toMatchObject({ refusal: { kind: "checks", limit: 1 } });
    expect((await createClaim(deps, { recall, payer: owner })).decision).toBe("pending");
  });
});

describe("findOpenClaim", () => {
  it("continues an open claim while its session runs, and not after", async () => {
    const claim = await createClaim(deps, { recall, payer: owner });
    expect((await findOpenClaim(deps, recall, owner.payerId))?.id).toBe(claim.id);
    clock = new Date(T0.getTime() + 11 * 60_000);
    expect(await findOpenClaim(deps, recall, owner.payerId)).toBeNull();
  });

  it("returns a claim already paid, so the owner sees it instead of starting over", async () => {
    const claim = await open();
    await send(claim);
    await checkClaim(deps, claim.id);
    clock = new Date(T0.getTime() + 60 * 60_000);
    expect((await findOpenClaim(deps, recall, owner.payerId))?.decision).toBe("paid");
  });

  it("ignores demo claims", async () => {
    await createClaim(deps, { recall, payer: owner, sample: demoSample("genuine")! });
    expect(await findOpenClaim(deps, recall, owner.payerId)).toBeNull();
  });
});

describe("receivePhotos", () => {
  it("saves the photos and their hashes on the claim, still pending, without calling the model", async () => {
    const claim = await open();
    const after = await send(claim, [photo("00000000000000ff"), photo("ff00000000000000")]);
    expect(after.decision).toBe("pending");
    expect(after.photos.map((p) => p.hash)).toEqual(["00000000000000ff", "ff00000000000000"]);
    expect((await store.getPhoto(after.photos[1].key))?.toString()).toBe("ff00000000000000");
    expect((await store.listClaims()).find((r) => r.id === claim.id)?.photoHashes).toHaveLength(2);
    expect(after.events.at(-1)?.type).toBe("prechecked");
    expect(deps.vision).not.toHaveBeenCalled();
  });

  it("blocks photos sent outside the claim's camera session, and keeps them", async () => {
    const claim = await open();
    const after = await send(claim, undefined, "cs_somewhere_else");
    expect(after.decision).toBe("blocked");
    expect(after.reasons.map((r) => r.check)).toEqual(["session"]);
    expect(after.photos).toHaveLength(1);
  });

  it("blocks a session that expired before the photos arrived", async () => {
    const claim = await open();
    clock = new Date(T0.getTime() + 10 * 60_000 + 1);
    expect((await send(claim)).reasons[0].text).toMatch(/expired/);
  });

  it("blocks a photo already used in another real claim, but not one used by seeded or demo claims", async () => {
    const first = await open();
    await send(first);
    const seeded = { ...(await open("K7P")), payerId: "SEEDPAYER", seeded: true, photos: [{ key: "seed/x.jpg", hash: "0f0f0f0f0f0f0f0f" }], decision: "paid" as const };
    await store.putClaim(seeded);

    const other = { ...(await createClaim(deps, { recall, payer: { payerId: "OTHER0000001", verified: true } })) };
    const blocked = await send(other);
    expect(blocked.decision).toBe("blocked");
    expect(blocked.reasons.map((r) => r.check)).toEqual(["duplicate_photo"]);

    const third = await createClaim(deps, { recall, payer: { payerId: "THIRD0000001", verified: true } });
    expect((await send(third, [photo("0f0f0f0f0f0f0f0f")])).decision).toBe("pending");
  });

  it("refuses a second upload, a wrong payer, too many photos and unreadable files", async () => {
    const claim = await open();
    await expect(receivePhotos(deps, { claimId: claim.id, payerId: "SOMEONEELSE", sessionId: claim.captureSession!.id, photos: [photo("00000000000000ff")] })).rejects.toMatchObject({ status: 404 });
    await expect(send(claim, [1, 2, 3, 4].map(() => photo("00000000000000ff")))).rejects.toMatchObject({ status: 400 });
    await expect(send(claim, [Buffer.from("not a jpeg")])).rejects.toBeInstanceOf(ClaimError);
    await send(claim);
    await expect(send(claim)).rejects.toMatchObject({ status: 409 });
  });
});

describe("demo claims", () => {
  const judge = { payerId: "JUDGE0000001", verified: true };
  const run = async (id: "genuine" | "wrong-code" | "reposted", payer = judge, hex = "00000000000000ff") => {
    const claim = await createClaim(deps, { recall, payer, sample: demoSample(id)! });
    return receivePhotos(deps, { claimId: claim.id, payerId: payer.payerId, sessionId: claim.captureSession!.id, photos: [photo(hex)] });
  };

  it("never meet real claims, and only meet the same judge's demo claims", async () => {
    const real = await open();
    await send(real);
    const g1 = await run("genuine");
    expect(g1.decision).toBe("pending");
    await checkClaim(deps, g1.id);
    // Another judge's genuine claim passes too.
    expect((await run("genuine", { payerId: "JUDGE0000002", verified: true })).decision).toBe("pending");
    const rows = await store.listClaims();
    expect(othersFor({ demo: true, payerId: judge.payerId }, rows).map((o) => o.id)).toEqual([g1.id]);
    expect(othersFor({ payerId: owner.payerId }, rows).map((o) => o.id)).toEqual([real.id]);
  });

  it("lets the genuine sample pass once per judge, then blocks it", async () => {
    const g1 = await run("genuine");
    await checkClaim(deps, g1.id);
    const g2 = await run("genuine");
    expect(g2.decision).toBe("blocked");
    expect(g2.reasons.map((r) => r.check)).toEqual(["duplicate_photo", "payer"]);
  });

  it("refuses a reposted photo as a duplicate, and lets the wrong code reach the model after a paid genuine claim", async () => {
    const g1 = await run("genuine");
    await checkClaim(deps, g1.id);
    const repost = await run("reposted");
    expect(repost.decision).toBe("blocked");
    expect(repost.reasons.map((r) => r.check)).toEqual(["duplicate_photo"]);
    const wrong = await run("wrong-code", judge, "f0f0f0f0f0f0f0f0");
    expect(wrong.decision).toBe("pending");
  });
});

describe("checkClaim", () => {
  it("pays a passing claim with its payout key, and records PayPal's status", async () => {
    const claim = await open();
    await send(claim);
    deps.vision.mockImplementationOnce(async ({ images }) => {
      // The photos were saved before the model was called.
      expect((await store.getClaim(claim.id))?.photos).toHaveLength(1);
      expect(images[0].toString()).toBe("00000000000000ff");
      return { verdict: verdict(), seconds: 9, model: "gpt-test" };
    });
    const paid = await checkClaim(deps, claim.id);
    expect(paid.decision).toBe("paid");
    expect(paid.payout).toMatchObject({ batchId: "BATCH1", status: "PENDING" });
    expect(deps.pay).toHaveBeenCalledWith(expect.objectContaining({ claimId: claim.id, payoutKey: claim.payoutKey, payerId: owner.payerId, amount: recall.refund }));
    expect(paid.events.map((e) => e.type)).toEqual(expect.arrayContaining(["checked", "decided", "payout_sent"]));
    expect((await store.listClaims()).find((r) => r.id === claim.id)?.payoutStatus).toBe("PENDING");
  });

  it("rejects a wrong code without paying", async () => {
    const claim = await open("K7P");
    await send(claim);
    deps.vision.mockResolvedValueOnce({ verdict: verdict({ code: "K7Q", matches: "no" }), seconds: 9, model: "gpt-test" });
    const after = await checkClaim(deps, claim.id);
    expect(after.decision).toBe("rejected");
    expect(after.reasons.find((r) => r.outcome === "reject")?.text).toBe("Written code reads K7Q; this claim's code is K7P");
    expect(deps.pay).not.toHaveBeenCalled();
  });

  it("holds an unclear answer for a person", async () => {
    const claim = await open();
    await send(claim);
    deps.vision.mockResolvedValueOnce({ verdict: verdict({ steps: ["done", "unclear"] }), seconds: 9, model: "gpt-test" });
    expect((await checkClaim(deps, claim.id)).decision).toBe("held");
    expect(deps.pay).not.toHaveBeenCalled();
  });

  it("holds the claim, never loses it, when the model fails", async () => {
    const claim = await open();
    await send(claim);
    deps.vision.mockRejectedValueOnce(new Error("503 from the model"));
    const after = await checkClaim(deps, claim.id);
    expect(after.decision).toBe("held");
    expect(after.reasons).toEqual([expect.objectContaining({ check: "model", outcome: "hold" })]);
    expect(after.events.at(-1)?.detail).toMatch(/503 from the model/);
  });

  it("holds the claim when PayPal refuses the payout", async () => {
    const claim = await open();
    await send(claim);
    deps.pay.mockRejectedValueOnce(new PayPalError("POST /v1/payments/payouts -> 422", 422, "RECEIVER_UNREGISTERED", "dbg-9", {}));
    const after = await checkClaim(deps, claim.id);
    expect(after.decision).toBe("held");
    expect(after.reasons.at(-1)).toMatchObject({ check: "payout", outcome: "hold" });
    expect(after.payout).toBeNull();
    expect(after.events.find((e) => e.type === "payout_failed")?.detail).toMatch(/RECEIVER_UNREGISTERED, debug id dbg-9/);
  });

  it("holds every passing claim when auto-pay is off", async () => {
    await store.putRecall({ ...recall, autoPay: false });
    const claim = await open();
    await send(claim);
    const after = await checkClaim(deps, claim.id);
    expect(after.decision).toBe("held");
    expect(after.reasons.at(-1)?.check).toBe("auto_pay");
    expect(deps.pay).not.toHaveBeenCalled();
  });

  it("re-checks on a fresh read before paying: a parallel claim paid during the model call holds this one", async () => {
    const a = await open();
    await send(a);
    const b = await createClaim(deps, { recall, payer: owner });
    // b slipped in before a's photos were indexed, e.g. from a second device.
    await store.putClaim({ ...b, photos: [{ key: "x/1.jpg", hash: "1111111111111111" }], decision: "paid" });
    const after = await checkClaim(deps, a.id);
    expect(after.decision).toBe("held");
    expect(after.reasons.at(-1)).toMatchObject({ check: "payer", outcome: "hold" });
    expect(deps.pay).not.toHaveBeenCalled();
  });

  it("leaves a claim a person decided during the model call, and never pays it", async () => {
    const claim = await open();
    await send(claim);
    deps.vision.mockImplementationOnce(async () => {
      const c = (await store.getClaim(claim.id))!;
      await store.putClaim({ ...c, decision: "rejected" });
      return { verdict: verdict(), seconds: 9, model: "gpt-test" };
    });
    expect((await checkClaim(deps, claim.id)).decision).toBe("rejected");
    expect(deps.pay).not.toHaveBeenCalled();
  });

  it("does nothing for a claim that's decided or has no photos yet", async () => {
    const claim = await open();
    expect((await checkClaim(deps, claim.id)).decision).toBe("pending");
    await send(claim);
    await checkClaim(deps, claim.id);
    await checkClaim(deps, claim.id);
    expect(deps.vision).toHaveBeenCalledTimes(1);
    expect(deps.pay).toHaveBeenCalledTimes(1);
    // Counted once, for the one model call.
    expect(await store.getUsage("2026-11-07")).toEqual({ vision: 1, draft: 0 });
  });

  it("holds a claim for a person, without calling the model, once the day's photo checks are used up", async () => {
    deps.limits.vision = 1;
    const first = await open();
    await send(first);
    expect((await checkClaim(deps, first.id)).decision).toBe("paid");
    const other = { payerId: "OWNER0000002", verified: true };
    const second = await createClaim(deps, { recall, payer: other });
    await receivePhotos(deps, { claimId: second.id, payerId: other.payerId, sessionId: second.captureSession!.id, photos: [photo("f0f0f0f0f0f0f0f0")] });
    const held = await checkClaim(deps, second.id);
    expect(held.decision).toBe("held");
    expect(held.reasons).toEqual([{ check: "model", outcome: "hold", text: LIMIT_HOLD }]);
    expect(held.photos).toHaveLength(1);
    expect(deps.vision).toHaveBeenCalledTimes(1);
    expect(checkRows(held, recall.spec).at(-1)).toMatchObject({ label: "Photo check", state: "hold", detail: LIMIT_HOLD });
    // The next UTC day has a fresh budget.
    clock = new Date("2026-11-08T00:00:01.000Z");
    const third = { payerId: "OWNER0000003", verified: true };
    const next = { ...(await createClaim(deps, { recall, payer: third })), code: "M4T" };
    await store.putClaim(next);
    await receivePhotos(deps, { claimId: next.id, payerId: third.payerId, sessionId: next.captureSession!.id, photos: [photo("0f0f0f0f0f0f0f0f")] });
    expect((await checkClaim(deps, next.id)).decision).toBe("paid");
    expect(deps.vision).toHaveBeenCalledTimes(2);
  });
});

describe("recoverStale", () => {
  it("holds a claim whose check never answered", async () => {
    const claim = await send(await open());
    clock = new Date(T0.getTime() + STALE_AFTER_MS - 1);
    expect((await recoverStale(deps, claim)).decision).toBe("pending");
    clock = new Date(T0.getTime() + STALE_AFTER_MS + 1);
    const after = await recoverStale(deps, claim);
    expect(after.decision).toBe("held");
    expect((await store.getClaim(claim.id))?.reasons[0].check).toBe("model");
    // A late model answer can't overwrite it.
    expect((await checkClaim(deps, claim.id)).decision).toBe("held");
    expect(deps.pay).not.toHaveBeenCalled();
  });
});

describe("checkRows", () => {
  it("walks the checks in order: pre-checks, the model's answers, then the payout", async () => {
    const claim = await send(await open());
    const pending = checkRows(claim, recall.spec);
    expect(pending.map((r) => r.id)).toEqual(["session", "duplicate_photo", "account", "label", "step_1", "step_2", "code", "screen", "payout"]);
    expect(pending.map((r) => r.state)).toEqual(["pass", "pass", "pass", "waiting", "waiting", "waiting", "waiting", "waiting", "waiting"]);

    const paid = checkRows(await checkClaim(deps, claim.id), recall.spec);
    expect(paid.every((r) => r.state === "pass")).toBe(true);
    expect(paid.find((r) => r.id === "label")?.quote).toBe("Tag reads X-VESOLJE in marker");
  });

  it("stops at the pre-checks for a blocked claim, and drops the payout row for a rejected one", async () => {
    const blocked = await send(await open(), undefined, "cs_nope");
    expect(checkRows(blocked, recall.spec).map((r) => `${r.id}:${r.state}`)).toEqual(["session:blocked", "duplicate_photo:pass", "account:pass"]);

    const claim = await send(await open("K7P"), [photo("aaaaaaaaaaaaaaaa")]);
    deps.vision.mockResolvedValueOnce({ verdict: verdict({ code: "K7Q", matches: "no" }), seconds: 9, model: "gpt-test" });
    const rows = checkRows(await checkClaim(deps, claim.id), recall.spec);
    expect(rows.find((r) => r.id === "code")?.state).toBe("reject");
    expect(rows.some((r) => r.id === "payout")).toBe(false);
  });
});
