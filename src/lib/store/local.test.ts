import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sampleClaim, sampleRecall } from "../__fixtures__/claim";
import { localStore } from "./local";

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

  it("rejects an invalid claim before writing it", async () => {
    const store = localStore(dir);
    await expect(store.putClaim(sampleClaim({ id: "bad" }))).rejects.toThrow();
    expect(await store.listClaims()).toEqual([]);
  });
});
