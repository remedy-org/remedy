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
import { buildSeedClaims, ensureDemoData, SEED_PHOTOS } from "./seed";
import storedVerdicts from "./verdicts.json";

const now = new Date("2026-11-07T12:00:00Z");
const hashes = Object.fromEntries(SEED_PHOTOS.map((p, i) => [p, (i + 1).toString(16).padStart(16, "0")]));

describe("buildSeedClaims", () => {
  const recall = demoRecall(new Date("2026-11-04T12:00:00Z"));
  const claims = buildSeedClaims({ recall, now, hashes });

  it("makes 40 valid seeded claims, newest first, over the last 3 days", () => {
    expect(claims).toHaveLength(40);
    for (const c of claims) expect(Claim.parse(c)).toEqual(c);
    expect(claims.every((c) => c.seeded && c.recallId === "27-071")).toBe(true);
    expect(new Set(claims.map((c) => c.id)).size).toBe(40);
    const times = claims.map((c) => Date.parse(c.createdAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(Math.min(...times)).toBeGreaterThan(now.getTime() - 72 * 3_600_000);
    expect(Math.max(...times)).toBeLessThan(now.getTime());
  });

  it("issues codes Remedy could issue, except where the photos already carry an eval case's code", () => {
    const evalCodes = new Set(storedVerdicts.map((v) => v.code));
    for (const c of claims) {
      if (c.decision === "pending") expect(c.code).toMatch(CODE_PATTERN);
      else expect(CODE_PATTERN.test(c.code) || evalCodes.has(c.code)).toBe(true);
    }
  });

  it("is mostly paid, with some held, rejected, blocked and pending", () => {
    const count = (d: string) => claims.filter((c) => c.decision === d).length;
    expect([count("paid"), count("held"), count("rejected"), count("blocked"), count("pending")]).toEqual([26, 3, 6, 3, 2]);
    expect(claims.slice(0, 2).map((c) => c.decision)).toEqual(["pending", "pending"]);
    expect(claims.filter((c) => c.payout?.status === "PENDING")).toHaveLength(1);
    expect(claims.filter((c) => c.payout).every((c) => c.payout!.batchId.startsWith("SEED"))).toBe(true);
  });

  it("decides every model answer with the app's own rule", () => {
    for (const c of claims.filter((c) => c.verdict)) {
      const { outcome, reasons } = decide(c.verdict!, { spec: recall.spec, code: c.code, photos: c.photos.length });
      expect({ paid: "pass", held: "hold", rejected: "reject" }[c.decision as string]).toBe(outcome);
      expect(c.reasons).toEqual(reasons);
    }
  });

  it("gives blocked claims pre-check reasons and no model answer", () => {
    const blocked = claims.filter((c) => c.decision === "blocked");
    expect(blocked.every((c) => c.verdict === null && c.reasons.length > 0)).toBe(true);
    expect(new Set(blocked.flatMap((c) => c.reasons.map((r) => r.check)))).toEqual(new Set(["duplicate_photo", "payer", "payer_verified"]));
  });

  it("is deterministic and keeps clear of real claim ids", () => {
    expect(buildSeedClaims({ recall, now, hashes })).toEqual(claims);
    const taken = new Set([claims[5].id]);
    expect(buildSeedClaims({ recall, now, hashes, taken }).map((c) => c.id)).not.toContain(claims[5].id);
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
    expect(await ensureDemoData(store, { now })).toEqual({ recall: "created", claims: "created", count: 40 });
    const recall = await getRecallBySlug(DEMO_SLUG, store);
    expect(recall).toMatchObject({ id: "27-071", refund: { value: "29.99" }, unitsSold: 19596, autoPay: true, owner: null });
    expect(await store.getPhoto("seed/c01-1.jpg")).not.toBeNull();

    await store.putRecall({ ...recall!, autoPay: false });
    expect(await ensureDemoData(store, { now })).toEqual({ recall: "kept", claims: "kept", count: 40 });
    expect((await store.getRecall("27-071"))?.autoPay).toBe(false);

    const later = new Date(now.getTime() + 24 * 3_600_000);
    expect(await ensureDemoData(store, { now: later, reset: true })).toMatchObject({ claims: "created", count: 40 });
    const rows = await store.listClaims();
    expect(rows).toHaveLength(40);
    expect(Date.parse(rows[0].createdAt)).toBeGreaterThan(now.getTime());
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
