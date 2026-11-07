import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sampleClaim, sampleRecall } from "../__fixtures__/claim";
import { getRecallBySlug } from "./index";
import { localStore } from "./local";
import { summarize } from "./store";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "remedy-store-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("localStore", () => {
  it("round-trips recalls, claims and photos", async () => {
    const store = localStore(dir);
    await store.putRecall(sampleRecall());
    await store.putClaim(sampleClaim());
    await store.putPhoto("RM-0412/1.jpg", Buffer.from("jpeg bytes"));

    expect(await store.getRecall("27-071")).toEqual(sampleRecall());
    expect(await store.getClaim("RM-0412")).toEqual(sampleClaim());
    expect((await store.getPhoto("RM-0412/1.jpg"))?.toString()).toBe("jpeg bytes");
    expect(await readdir(join(dir, "claims"))).toEqual(["RM-0412.json"]);
  });

  it("returns null for anything missing", async () => {
    const store = localStore(dir);
    expect(await store.getRecall("27-999")).toBeNull();
    expect(await store.getClaim("RM-9999")).toBeNull();
    expect(await store.getPhoto("RM-9999/1.jpg")).toBeNull();
    expect(await store.listClaims()).toEqual([]);
  });

  it("treats a malformed id as not found, so it can't escape the folder", async () => {
    const store = localStore(dir);
    expect(await store.getClaim("../../etc/passwd")).toBeNull();
    expect(await store.getRecall("../x")).toBeNull();
    await expect(store.getPhoto("../secret.jpg")).rejects.toThrow();
  });

  it("keeps one index row per claim, newest first, updated in place", async () => {
    const store = localStore(dir);
    await store.putClaim(sampleClaim());
    await store.putClaim(sampleClaim({ id: "RM-0500", createdAt: "2026-11-07T11:00:00.000Z" }));
    await store.putClaim(sampleClaim({ decision: "paid", payout: { batchId: "B1", status: "SUCCESS", updatedAt: "2026-11-07T10:01:00.000Z" } }));

    const rows = await store.listClaims();
    expect(rows.map((r) => [r.id, r.decision, r.payoutStatus])).toEqual([
      ["RM-0500", "pending", null],
      ["RM-0412", "paid", "SUCCESS"],
    ]);
    expect(rows[1].photoHashes).toEqual(["0123456789abcdef"]);
    expect(JSON.parse(await readFile(join(dir, "index.json"), "utf8")).claims).toHaveLength(2);
  });

  it("doesn't lose index rows to concurrent writes", async () => {
    const store = localStore(dir);
    await Promise.all(Array.from({ length: 20 }, (_, i) => store.putClaim(sampleClaim({ id: `RM-${String(i).padStart(4, "0")}` }))));
    expect(await store.listClaims()).toHaveLength(20);
  });

  it("adds claims up to a limit counted on the index, even when the adds race, and writes no file for a refused one", async () => {
    const store = localStore(dir);
    const full = (rows: unknown[]) => (rows.length >= 3 ? "full" : null);
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => store.addClaim(sampleClaim({ id: `RM-${String(i).padStart(4, "0")}` }), full)));
    expect(results.filter((r) => r === null)).toHaveLength(3);
    expect(results.filter((r) => r === "full")).toHaveLength(7);
    expect(await store.listClaims()).toHaveLength(3);
    expect(await readdir(join(dir, "claims"))).toHaveLength(3);
    await expect(store.addClaim(sampleClaim({ id: "RM-0000" }), () => null)).rejects.toThrow(/taken/);
  });

  it("indexes recalls by slug, oldest first, and refuses a taken slug", async () => {
    const store = localStore(dir);
    await store.putRecall(sampleRecall());
    await store.putRecall({ ...sampleRecall(), id: "27-100", slug: "other", owner: "PAYER1", createdAt: "2026-11-07T09:00:00.000Z" });
    await store.putRecall({ ...sampleRecall(), autoPay: false });

    expect((await store.listRecalls()).map((r) => [r.id, r.slug, r.owner])).toEqual([
      ["27-071", "kikea-x-vesolje", null],
      ["27-100", "other", "PAYER1"],
    ]);
    expect((await getRecallBySlug("kikea-x-vesolje", store))?.autoPay).toBe(false);
    expect(await getRecallBySlug("missing", store)).toBeNull();
    await expect(store.putRecall({ ...sampleRecall(), id: "27-200", slug: "other" })).rejects.toThrow(/taken/);
    expect(await store.getRecall("27-200")).toBeNull();
  });

  it("carries the seeded and demo flags into the index", async () => {
    const store = localStore(dir);
    await store.putClaim(sampleClaim({ seeded: true }));
    await store.putClaim(sampleClaim({ id: "RM-0500" }));
    const rows = await store.listClaims();
    expect(rows.find((r) => r.id === "RM-0412")?.seeded).toBe(true);
    expect(rows.find((r) => r.id === "RM-0500")).not.toHaveProperty("seeded");
  });

  it("carries what the console grid and the demo picker show into the index", async () => {
    const store = localStore(dir);
    const amount = { value: "29.99", currency: "USD" as const };
    await store.putClaim(
      sampleClaim({
        decision: "paid",
        reasons: [{ check: "label", outcome: "pass", text: "ok" }, { check: "review", outcome: "pass", text: "Approved on review by Kikea" }],
        payout: { batchId: "B1", status: "PENDING", updatedAt: "2026-11-07T10:01:00.000Z", amount },
        demo: true,
        events: [{ at: "2026-11-07T10:00:00.000Z", type: "demo_sample", detail: "genuine" }],
      }),
    );
    expect((await store.listClaims())[0]).toMatchObject({ payerVerified: true, payoutAmount: amount, reason: { check: "review" }, sample: "genuine" });
    await store.updateClaim("RM-0412", (c) => ({ ...c, decision: "held", reasons: [{ check: "code", outcome: "hold", text: "Code unclear" }], payout: null }));
    expect((await store.listClaims())[0]).toMatchObject({ decision: "held", payoutAmount: null, reason: { text: "Code unclear" } });
  });

  it("fills in index rows written before they carried the grid's fields, once", async () => {
    const store = localStore(dir);
    const claim = sampleClaim({ decision: "rejected", reasons: [{ check: "code", outcome: "reject", text: "Written code reads K7O" }] });
    await store.putClaim(claim);
    await store.putClaim(sampleClaim({ id: "RM-0500" }));
    const NEW = ["payerVerified", "payoutAmount", "reason", "sample"];
    const old = (row: object) => Object.fromEntries(Object.entries(row).filter(([k]) => !NEW.includes(k)));
    const legacy = { claims: [old(summarize(claim)), old(summarize(sampleClaim({ id: "RM-0999" }))), summarize(sampleClaim({ id: "RM-0500" }))] };
    await writeFile(join(dir, "index.json"), JSON.stringify(legacy));

    const rows = await store.listClaims();
    expect(rows[0]).toEqual(summarize(claim));
    // RM-0999's file is gone: saved with what the row knows.
    expect(rows[1]).toMatchObject({ id: "RM-0999", payerVerified: false, payoutAmount: null, reason: null });
    expect(JSON.parse(await readFile(join(dir, "index.json"), "utf8")).claims).toEqual(rows);
  });

  it("counts model calls per UTC day up to the limit, writing nothing at it", async () => {
    const store = localStore(dir);
    expect(await store.getUsage("2026-11-07")).toEqual({ vision: 0, draft: 0 });
    const taken = await Promise.all(Array.from({ length: 5 }, () => store.takeUsage("2026-11-07", "vision", 3)));
    expect(taken.filter(Boolean)).toHaveLength(3);
    expect(await store.takeUsage("2026-11-07", "draft", 1)).toBe(true);
    expect(await store.getUsage("2026-11-07")).toEqual({ vision: 3, draft: 1 });
    expect(await store.getUsage("2026-11-08")).toEqual({ vision: 0, draft: 0 });
    expect(await readdir(join(dir, "usage"))).toEqual(["2026-11-07.json"]);
    await expect(store.takeUsage("../x", "vision", 3)).rejects.toThrow();
  });

  it("rejects an invalid claim before writing it", async () => {
    const store = localStore(dir);
    await expect(store.putClaim(sampleClaim({ id: "bad" }))).rejects.toThrow();
    expect(await store.listClaims()).toEqual([]);
  });
});
