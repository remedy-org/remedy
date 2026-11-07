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
import {
  checkClaim,
  ClaimError,
  createClaim,
  duplicateOf,
  findOpenClaim,
  LIMIT_HOLD,
  LimitReached,
  notYet,
  openStart,
  othersFor,
  receivePhotos,
  recoverStale,
  requestReview,
  roundClaims,
  STALE_AFTER_MS,
  type PipelineDeps,
} from "./pipeline";

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

  it("keeps demo starts out of the daily and 30-day totals: judges can't fill them, and real owners can't lock judges out", async () => {
    deps.limits.claimsPerDay = 2;
    deps.limits.claimsPerMonth = 2;
    deps.limits.accountDemosPerDay = 4;
    for (let i = 0; i < 4; i++) await createClaim(deps, { recall, payer: owner, sample: demoSample("genuine")! });
    // Four demo claims on the day: a real owner still starts, up to the real totals.
    await createClaim(deps, { recall, payer: { payerId: "OWNER0000002", verified: true } });
    await createClaim(deps, { recall, payer: { payerId: "OWNER0000003", verified: true } });
    await expect(createClaim(deps, { recall, payer: { payerId: "OWNER0000004", verified: true } })).rejects.toMatchObject({ refusal: { kind: "monthly", limit: 2 } });
    // The real totals are full, yet another sandbox account still runs the samples; this one has used its own four.
    expect((await createClaim(deps, { recall, payer: { payerId: "JUDGE0000002", verified: true }, sample: demoSample("genuine")! })).demo).toBe(true);
    await expect(createClaim(deps, { recall, payer: owner, sample: demoSample("genuine")! })).rejects.toMatchObject({ refusal: { kind: "account", limit: 4 } });
  });

  it("stops counting a demo start left before its photo once its camera session is over; a sent one keeps counting", async () => {
    deps.limits.accountDemosPerDay = 2;
    const left = await createClaim(deps, { recall, payer: owner, sample: demoSample("wrong-code")! });
    const sent = await createClaim(deps, { recall, payer: owner, sample: demoSample("genuine")! });
    await receivePhotos(deps, { claimId: sent.id, payerId: owner.payerId, sessionId: sent.captureSession!.id, photos: [photo("00000000000000ff")] });
    // Both count while the left one's camera session is still open.
    await expect(createClaim(deps, { recall, payer: owner, sample: demoSample("wrong-code")! })).rejects.toMatchObject({ refusal: { kind: "account", limit: 2 } });
    clock = new Date(T0.getTime() + 10 * 60_000);
    const again = await createClaim(deps, { recall, payer: owner, sample: demoSample("wrong-code")! });
    expect(again.id).not.toBe(left.id);
    // Real claims never stop counting: an abandoned real start still uses the account's day.
    deps.limits.accountClaimsPerDay = 1;
    await createClaim(deps, { recall, payer: owner });
    clock = new Date(T0.getTime() + 30 * 60_000);
    await expect(createClaim(deps, { recall, payer: owner })).rejects.toMatchObject({ refusal: { kind: "account", limit: 1 } });
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

describe("demo claims without a round (filed before rounds)", () => {
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
    expect(othersFor({ demo: true, payerId: judge.payerId, events: [] }, rows).map((o) => o.id)).toEqual([g1.id]);
    expect(othersFor({ payerId: owner.payerId, events: [] }, rows).map((o) => o.id)).toEqual([real.id]);
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

describe("duplicateOf", () => {
  const judge = { payerId: "JUDGE0000001", verified: true };
  const R = "dr_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const run = async (id: "genuine" | "reposted", photos: string[], round = R) => {
    clock = new Date(clock.getTime() + 1000);
    const claim = await createClaim(deps, { recall, payer: judge, sample: demoSample(id)!, round });
    return receivePhotos(deps, { claimId: claim.id, payerId: judge.payerId, sessionId: claim.captureSession!.id, photos: photos.map(photo) });
  };

  it("finds the round's earlier claim with the photo, and which photo on each side", async () => {
    const genuine = await run("genuine", ["f0f0f0f0f0f0f0f0", "00000000000000ff"]);
    await checkClaim(deps, genuine.id);
    const repost = await run("reposted", ["0f0f0f0f0f0f0f0f", "00000000000000ff"]);
    expect(repost.decision).toBe("blocked");
    expect(duplicateOf(repost, await store.listClaims())).toEqual({ photo: 2, id: genuine.id, theirs: 2, payerId: judge.payerId, sample: "genuine" });
  });

  it("names the original, not a later repost of it, and nothing from another round", async () => {
    const genuine = await run("genuine", ["00000000000000ff"]);
    await checkClaim(deps, genuine.id);
    const first = await run("reposted", ["00000000000000ff"]);
    const second = await run("reposted", ["00000000000000ff"]);
    const rows = await store.listClaims();
    expect(duplicateOf(second, rows)?.id).toBe(genuine.id);
    expect(duplicateOf(first, rows)?.id).toBe(genuine.id);
    const other = await run("reposted", ["00000000000000ff"], "dr_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    expect(duplicateOf(other, await store.listClaims())).toBeNull();
  });

  it("finds another account's real claim, so the page can hide its photo and id", async () => {
    const theirs = await open();
    await send(theirs);
    clock = new Date(clock.getTime() + 1000);
    const mine = await createClaim(deps, { recall, payer: { payerId: "OWNER0000002", verified: true } });
    const sent = await receivePhotos(deps, { claimId: mine.id, payerId: mine.payerId, sessionId: mine.captureSession!.id, photos: [photo("00000000000000ff")] });
    expect(sent.reasons.map((r) => r.check)).toContain("duplicate_photo");
    expect(duplicateOf(sent, await store.listClaims())).toMatchObject({ photo: 1, id: theirs.id, theirs: 1, payerId: owner.payerId });
  });
});

describe("demo rounds", () => {
  const judge = { payerId: "JUDGE0000001", verified: true };
  const A = "dr_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const B = "dr_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const run = async (id: "genuine" | "wrong-code" | "reposted", round: string | undefined, payer = judge, hex = "00000000000000ff") => {
    const claim = await createClaim(deps, { recall, payer, sample: demoSample(id)!, round });
    return receivePhotos(deps, { claimId: claim.id, payerId: payer.payerId, sessionId: claim.captureSession!.id, photos: [photo(hex)] });
  };

  it("records the round on the claim and its index row, and never on a real claim", async () => {
    const demo = await createClaim(deps, { recall, payer: judge, sample: demoSample("genuine")!, round: A });
    const real = await createClaim(deps, { recall, payer: owner, round: A });
    expect(demo.demoRound).toBe(A);
    expect(real.demoRound).toBeUndefined();
    const rows = await store.listClaims();
    expect(rows.find((r) => r.id === demo.id)?.demoRound).toBe(A);
    expect(rows.find((r) => r.id === real.id)?.demoRound).toBeUndefined();
  });

  it("checks a demo claim only against its own round: not other rounds, legacy claims or real claims", async () => {
    const real = await open();
    await send(real);
    const legacy = await run("genuine", undefined);
    const a1 = await run("genuine", A);
    const b1 = await run("genuine", B);
    // Another account logged in with round A's cookie: a round of its own, so a second login in one browser starts afresh.
    const a2 = await run("wrong-code", A, { payerId: "JUDGE0000002", verified: true }, "f0f0f0f0f0f0f0f0");
    const rows = await store.listClaims();
    const ids = (claim: Omit<Parameters<typeof othersFor>[0], "events">) => othersFor({ ...claim, events: [] }, rows).map((o) => o.id).sort();
    expect(ids({ demo: true, payerId: judge.payerId, demoRound: A })).toEqual([a1.id]);
    expect(ids({ demo: true, payerId: "JUDGE0000002", demoRound: A })).toEqual([a2.id]);
    expect(ids({ demo: true, payerId: judge.payerId, demoRound: B })).toEqual([b1.id]);
    // A claim from before rounds meets only that account's claims from before rounds.
    expect(ids({ demo: true, payerId: judge.payerId })).toEqual([legacy.id]);
    expect(ids({ demo: true, payerId: "JUDGE0000002" })).toEqual([]);
    expect(ids({ payerId: owner.payerId })).toEqual([real.id]);
    expect(roundClaims(rows, recall.id, A, judge.payerId).map((r) => r.id)).toEqual([a1.id]);
    expect(roundClaims(rows, recall.id, A, "JUDGE0000002").map((r) => r.id)).toEqual([a2.id]);
    expect(roundClaims(rows, "other-recall", A, judge.payerId)).toEqual([]);
  });

  it("pays the genuine sample once in every round on one account, and still blocks it twice in one round", async () => {
    for (const round of [A, B]) {
      const genuine = await run("genuine", round);
      expect(genuine.decision).toBe("pending");
      expect((await checkClaim(deps, genuine.id)).decision).toBe("paid");
      const repost = await run("reposted", round);
      expect(repost.decision).toBe("blocked");
      expect(repost.reasons.map((r) => r.check)).toEqual(["duplicate_photo"]);
      const wrong = await run("wrong-code", round, judge, "f0f0f0f0f0f0f0f0");
      expect(wrong.decision).toBe("pending");
    }
    expect(deps.pay).toHaveBeenCalledTimes(2);
    const again = await run("genuine", B);
    expect(again.decision).toBe("blocked");
    expect(again.reasons.map((r) => r.check)).toEqual(["duplicate_photo", "payer"]);
  });

  it("pays the genuine sample when the other samples run while it is at the model", async () => {
    const genuine = await run("genuine", A);
    // Sent from another tab during the genuine claim's model call: waiting on the model, blocked as a repost.
    const wrong = await run("wrong-code", A, judge, "f0f0f0f0f0f0f0f0");
    expect(wrong.decision).toBe("pending");
    const repost = await run("reposted", A);
    expect(repost.decision).toBe("blocked");
    expect(repost.reasons.map((r) => r.check)).toEqual(["duplicate_photo"]);
    expect((await checkClaim(deps, genuine.id)).decision).toBe("paid");
  });

  it("never blocks the genuine sample behind another sample waiting on the model or held", async () => {
    const wrong = await run("wrong-code", A, judge, "f0f0f0f0f0f0f0f0");
    expect((await run("genuine", A)).decision).toBe("pending");
    // The model couldn't read the wrong code's tag, so that claim is held for a person.
    deps.vision.mockImplementationOnce(async () => ({ verdict: verdict({ code: "K7Q", matches: "unclear" }), seconds: 1, model: "gpt-test" }));
    expect((await checkClaim(deps, wrong.id)).decision).toBe("held");
    const genuine = await run("genuine", B);
    await run("wrong-code", B, judge, "f0f0f0f0f0f0f0f0");
    expect(genuine.decision).toBe("pending");
    expect((await checkClaim(deps, genuine.id)).decision).toBe("paid");
  });

  it("starts a second PayPal login in the same browser on a round of its own", async () => {
    const other = { payerId: "JUDGE0000002", verified: true };
    await checkClaim(deps, (await run("genuine", A)).id);
    expect(roundClaims(await store.listClaims(), recall.id, A, other.payerId)).toEqual([]);
    expect(notYet(demoSample("reposted")!, roundClaims(await store.listClaims(), recall.id, A, other.payerId))).not.toBeNull();
    const genuine = await run("genuine", A, other);
    expect(genuine.decision).toBe("pending");
    expect((await checkClaim(deps, genuine.id)).decision).toBe("paid");
  });

  it("continues a sample's start still waiting for its photo, rather than leaving another empty one", async () => {
    const first = await createClaim(deps, { recall, payer: judge, sample: demoSample("wrong-code")!, round: A });
    const mine = async () => roundClaims(await store.listClaims(), recall.id, A, judge.payerId);
    expect(openStart(await mine(), "wrong-code", clock)?.id).toBe(first.id);
    // Another sample, another round, or a start whose photo was sent: a new claim.
    expect(openStart(await mine(), "genuine", clock)).toBeNull();
    expect(openStart(roundClaims(await store.listClaims(), recall.id, B, judge.payerId), "wrong-code", clock)).toBeNull();
    await receivePhotos(deps, { claimId: first.id, payerId: judge.payerId, sessionId: first.captureSession!.id, photos: [photo("00000000000000ff")] });
    expect(openStart(await mine(), "wrong-code", clock)).toBeNull();
    // Past half its camera session, a start isn't worth continuing: the owner would run out of time.
    await createClaim(deps, { recall, payer: judge, sample: demoSample("genuine")!, round: A });
    expect(openStart(await mine(), "genuine", new Date(clock.getTime() + 5 * 60_000))).toBeNull();
  });

  it("files the repost only once this round's genuine photo was sent", async () => {
    const repost = demoSample("reposted")!;
    const mine = async () => roundClaims(await store.listClaims(), recall.id, A, judge.payerId);
    expect(notYet(repost, await mine())).toMatch(/^Send "A genuine claim" first/);
    // Filed but no photo yet, or sent in another round: still not yet.
    await createClaim(deps, { recall, payer: judge, sample: demoSample("genuine")!, round: A });
    await run("genuine", B);
    expect(notYet(repost, await mine())).not.toBeNull();
    await run("genuine", A);
    expect(notYet(repost, await mine())).toBeNull();
    // Samples with nothing to wait for are never held back.
    expect(notYet(demoSample("wrong-code")!, [])).toBeNull();
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

describe("requestReview", () => {
  // The model hedged on the code it read (eval case c09), so the rule's reject rests on an uncertain read.
  const unsure = (): Verdict => {
    const v = verdict({ code: "K7O", matches: "no" });
    return { ...v, challenge_code: { ...v.challenge_code, evidence: 'The tag appears to read "K7O"; the last character could also be "0".' } };
  };
  async function refused(v = unsure()) {
    const claim = await send(await open("K7Q"));
    deps.vision.mockResolvedValueOnce({ verdict: v, seconds: 9, model: "gpt-test" });
    return checkClaim(deps, claim.id);
  }

  it("holds an uncertain-read rejection for a person, keeping the model's verdict and the rule's reasons", async () => {
    const before = await refused();
    expect(before.decision).toBe("rejected");
    clock = new Date(T0.getTime() + 60_000);
    const after = await requestReview(deps, { claimId: before.id, payerId: owner.payerId });
    expect(after.decision).toBe("held");
    expect(after.verdict).toEqual(before.verdict);
    expect(after.reasons).toEqual([...before.reasons, { check: "appeal", outcome: "hold", text: "Owner asked for a review" }]);
    expect(after.events.slice(0, -1)).toEqual(before.events);
    expect(after.events.at(-1)).toMatchObject({ type: "review_requested", at: clock.toISOString() });
    const row = (await store.listClaims()).find((r) => r.id === before.id)!;
    expect(row.decision).toBe("held");
    expect(row.reason?.text).toBe("Owner asked for a review");
    expect(deps.pay).not.toHaveBeenCalled();
  });

  it("asks once: a second ask returns the claim as it is", async () => {
    const claim = await refused();
    const first = await requestReview(deps, { claimId: claim.id, payerId: owner.payerId });
    const second = await requestReview(deps, { claimId: claim.id, payerId: owner.payerId });
    expect(second).toEqual(first);
    expect(second.events.filter((e) => e.type === "review_requested")).toHaveLength(1);
  });

  it("refuses a confident rejection, a claim that isn't rejected, and another account's claim", async () => {
    const confident = await refused(verdict({ code: "K7P", matches: "no" }));
    await expect(requestReview(deps, { claimId: confident.id, payerId: owner.payerId })).rejects.toMatchObject({ status: 409 });
    expect((await store.getClaim(confident.id))?.decision).toBe("rejected");

    const blocked = await send(await open(), [photo("00000000000000ff")], "cs_elsewhere");
    expect(blocked.decision).toBe("blocked");
    await expect(requestReview(deps, { claimId: blocked.id, payerId: owner.payerId })).rejects.toMatchObject({ status: 409 });

    const unsureClaim = await refused();
    await expect(requestReview(deps, { claimId: unsureClaim.id, payerId: "SOMEONEELSE01" })).rejects.toBeInstanceOf(ClaimError);
  });

  it("refuses while another claim of the owner's for this recall counts", async () => {
    const claim = await refused();
    const newer = await open();
    await expect(requestReview(deps, { claimId: claim.id, payerId: owner.payerId })).rejects.toThrow(newer.id);
    // Once the newer claim's code has expired unused, the ask goes through.
    clock = new Date(T0.getTime() + 11 * 60_000);
    expect((await requestReview(deps, { claimId: claim.id, payerId: owner.payerId })).decision).toBe("held");
  });
});

describe("checkRows", () => {
  it("walks the checks in order: pre-checks, the model's answers, then the payout", async () => {
    const claim = await send(await open());
    const pending = checkRows(claim, recall.spec);
    expect(pending.map((r) => r.id)).toEqual(["session", "duplicate_photo", "account", "label", "code", "step_1", "step_2", "screen", "payout"]);
    expect(pending.map((r) => r.state)).toEqual(["pass", "pass", "pass", "waiting", "waiting", "waiting", "waiting", "waiting", "waiting"]);

    const paid = checkRows(await checkClaim(deps, claim.id), recall.spec);
    expect(paid.every((r) => r.state === "pass")).toBe(true);
    expect(paid.find((r) => r.id === "label")?.quote).toBe("Tag reads X-VESOLJE in marker");
  });

  it("stops at the pre-checks for a blocked claim, and drops the payout row for a rejected one", async () => {
    const blocked = await send(await open(), undefined, "cs_nope");
    expect(checkRows(blocked, recall.spec).map((r) => `${r.id}:${r.state}`)).toEqual(["session:blocked", "duplicate_photo:pass", "account:pass"]);

    // In the demo only the genuine sample meets the one-claim check, so the others say it didn't run.
    const sampleRow = (id: string) => checkRows({ ...blocked, demo: true, events: [{ at: blocked.createdAt, type: "demo_sample", detail: id }] }, recall.spec).find((r) => r.id === "account");
    expect(sampleRow("genuine")).toMatchObject({ state: "pass", detail: expect.stringContaining("Checked within this demo round") });
    expect(sampleRow("ai-no-session")?.state).toBe("skipped");

    const claim = await send(await open("K7P"), [photo("aaaaaaaaaaaaaaaa")]);
    deps.vision.mockResolvedValueOnce({ verdict: verdict({ code: "K7Q", matches: "no" }), seconds: 9, model: "gpt-test" });
    const rows = checkRows(await checkClaim(deps, claim.id), recall.spec);
    expect(rows.find((r) => r.id === "code")?.state).toBe("reject");
    expect(rows.some((r) => r.id === "payout")).toBe(false);
  });
});
