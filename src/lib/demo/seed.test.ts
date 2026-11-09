import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CODE_PATTERN } from "../codes";
import { decide } from "../rule";
import { getRecallBySlug } from "../store";
import { localStore } from "../store/local";
import { Claim } from "../types";
import { DEMO_SLUG, demoRecall } from "./kikea";
import { DEMO_SAMPLES } from "./samples";
import { DEMO_CLAIMS } from "./claims";
import { buildSeedClaims, ensureDemoData, SEED_PHOTOS } from "./seed";
import storedVerdicts from "./verdicts.json";

const now = new Date("2026-11-07T12:00:00Z");
const hashes = Object.fromEntries(SEED_PHOTOS.map((p, i) => [p, (i + 1).toString(16).padStart(16, "0")]));

describe("buildSeedClaims", () => {
  const recall = demoRecall(new Date("2026-11-04T12:00:00Z"));
  const claims = buildSeedClaims({ recall, hashes });

  it("builds the demo claims as valid seeded claims, newest first, at their own fixed times", () => {
    expect(claims.map((c) => c.id)).toEqual(DEMO_CLAIMS.map((d) => d.id));
    for (const c of claims) expect(Claim.parse(c)).toEqual(c);
    expect(claims.every((c) => c.seeded && c.recallId === "27-071")).toBe(true);
    expect(claims.map((c) => c.createdAt)).toEqual(DEMO_CLAIMS.map((d) => new Date(d.filed).toISOString()));
  });

  it("has exactly one repost, and it names the claim it copied", () => {
    const reposts = claims.filter((c) => c.reasons.some((r) => r.check === "duplicate_photo"));
    expect(reposts).toHaveLength(1);
    const named = reposts[0].reasons.find((r) => r.check === "duplicate_photo")!.text.match(/RM-\d{4}/)?.[0];
    const copied = claims.find((c) => c.id === named);
    expect(copied?.decision).toBe("paid");
    expect(copied!.photos.map((p) => p.hash)).toEqual(reposts[0].photos.map((p) => p.hash));
    expect(Date.parse(copied!.createdAt)).toBeLessThan(Date.parse(reposts[0].createdAt));
  });

  it("issues codes Remedy could issue, except where the photos already carry an eval case's code", () => {
    const evalCodes = new Set(storedVerdicts.map((v) => v.code));
    for (const c of claims) expect(CODE_PATTERN.test(c.code) || evalCodes.has(c.code)).toBe(true);
  });

  it("pays only RM-0442 through PayPal, 15 s after its photo; the other claim the rule passed has nothing sent", () => {
    const paid = claims.filter((c) => c.decision === "paid");
    expect(paid.map((c) => [c.id, c.payout?.status ?? null])).toEqual([
      ["RM-0442", "SUCCESS"],
      ["RM-6276", null],
    ]);
    const genuine = paid[0];
    const photos = Date.parse(genuine.events.find((e) => e.type === "photos_received")!.at);
    expect((Date.parse(genuine.events.find((e) => e.type === "payout_sent")!.at) - photos) / 1000).toBe(15);
  });

  it("decides every model answer with the app's own rule", () => {
    for (const c of claims.filter((c) => c.verdict)) {
      const { outcome, reasons } = decide(c.verdict!, { spec: recall.spec, code: c.code, photos: c.photos.length });
      expect({ paid: "pass", held: "hold", rejected: "reject" }[c.decision as string]).toBe(outcome);
      expect(c.reasons).toEqual(reasons);
    }
  });

  it("gives blocked claims pre-check reasons and no model answer, one for each of the first three checks", () => {
    const blocked = claims.filter((c) => c.decision === "blocked");
    expect(blocked.every((c) => c.verdict === null && c.reasons.length > 0)).toBe(true);
    expect(new Set(blocked.flatMap((c) => c.reasons.map((r) => r.check)))).toEqual(new Set(["session", "duplicate_photo", "payer_verified"]));
  });

  it("is deterministic and keeps clear of real claim ids", () => {
    expect(buildSeedClaims({ recall, hashes })).toEqual(claims);
    const taken = new Set([claims[0].id]);
    expect(buildSeedClaims({ recall, hashes, taken }).map((c) => c.id)).not.toContain(claims[0].id);
  });
});

describe("ensureDemoData", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "remedy-seed-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("seeds once, keeps a company's edits, and reseeds on reset", async () => {
    const store = localStore(dir);
    expect(await ensureDemoData(store, { now })).toEqual({ recall: "created", claims: "created", count: DEMO_CLAIMS.length });
    const recall = await getRecallBySlug(DEMO_SLUG, store);
    expect(recall).toMatchObject({ id: "27-071", refund: { value: "29.99" }, unitsSold: 19596, autoPay: true, owner: null });
    expect(await store.getPhoto("seed/c02-1.jpg")).not.toBeNull();

    await store.putRecall({ ...recall!, autoPay: false });
    expect(await ensureDemoData(store, { now })).toEqual({ recall: "kept", claims: "kept", count: DEMO_CLAIMS.length });
    expect((await store.getRecall("27-071"))?.autoPay).toBe(false);

    expect(await ensureDemoData(store, { now, reset: true })).toMatchObject({ claims: "created", count: DEMO_CLAIMS.length });
    expect(await store.listClaims()).toHaveLength(DEMO_CLAIMS.length);
  });
});

describe("demo samples", () => {
  it("point at committed photos of our own cases", () => {
    for (const s of DEMO_SAMPLES) {
      expect(s.source).toMatch(/^c\d\d-/);
      for (const p of s.photos) expect(existsSync(join(process.cwd(), "public", p))).toBe(true);
    }
  });

  it("issue only codes Remedy could issue, whatever the photo's tag says", () => {
    for (const s of DEMO_SAMPLES) if (s.code !== null) expect(s.code).toMatch(CODE_PATTERN);
  });

  it("say the reposted photo's tag shows the code of the claim it reposts", () => {
    for (const s of DEMO_SAMPLES.filter((s) => s.after)) expect(s.tagReads).toBe(DEMO_SAMPLES.find((o) => o.id === s.after)!.code);
  });
});
