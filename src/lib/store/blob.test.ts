import { beforeEach, describe, expect, it, vi } from "vitest";
import { sampleClaim, sampleRecall } from "../__fixtures__/claim";

// An in-memory stand-in for @vercel/blob's put/get, with its etag and ifMatch behaviour.
const blobs = vi.hoisted(() => new Map<string, { body: Buffer; etag: string; access: string }>());
const calls = vi.hoisted(() => ({ put: [] as { pathname: string; options: Record<string, unknown> }[], get: [] as { pathname: string; options: Record<string, unknown> }[] }));

vi.mock("@vercel/blob", () => {
  class BlobPreconditionFailedError extends Error {}
  let n = 0;
  return {
    BlobPreconditionFailedError,
    put: vi.fn(async (pathname: string, body: string | Buffer, options: Record<string, unknown>) => {
      calls.put.push({ pathname, options });
      const current = blobs.get(pathname);
      if (options.ifMatch && current?.etag !== options.ifMatch) throw new BlobPreconditionFailedError();
      if (current && !options.allowOverwrite) throw new Error("exists");
      const etag = `"e${++n}"`;
      blobs.set(pathname, { body: Buffer.from(body), etag, access: options.access as string });
      return { pathname, etag };
    }),
    get: vi.fn(async (pathname: string, options: Record<string, unknown>) => {
      calls.get.push({ pathname, options });
      const b = blobs.get(pathname);
      if (!b) return null;
      return { statusCode: 200, stream: new Response(new Uint8Array(b.body)).body, blob: { etag: b.etag } };
    }),
  };
});

const { blobStore } = await import("./blob");

beforeEach(() => {
  blobs.clear();
  calls.put.length = 0;
  calls.get.length = 0;
});

describe("blobStore", () => {
  it("stores everything private, under the expected paths", async () => {
    const store = blobStore("tok");
    await store.putRecall(sampleRecall());
    await store.putClaim(sampleClaim());
    await store.putPhoto("RM-0412/1.jpg", Buffer.from("jpeg"));

    expect([...blobs.keys()].sort()).toEqual(["claims/RM-0412.json", "index.json", "photos/RM-0412/1.jpg", "recalls.json", "recalls/27-071.json"]);
    expect([...blobs.values()].every((b) => b.access === "private")).toBe(true);
    expect(calls.put.every((c) => c.options.token === "tok")).toBe(true);
    expect(calls.put.find((c) => c.pathname.startsWith("photos/"))?.options.contentType).toBe("image/jpeg");

    expect(await store.getClaim("RM-0412")).toEqual(sampleClaim());
    expect(await store.getRecall("27-071")).toEqual(sampleRecall());
    expect((await store.getPhoto("RM-0412/1.jpg"))?.toString()).toBe("jpeg");
    expect(calls.get.find((c) => c.pathname === "claims/RM-0412.json")?.options).toMatchObject({ access: "private", useCache: false });
  });

  it("lists claims from index.json alone", async () => {
    const store = blobStore("tok");
    await store.putClaim(sampleClaim());
    calls.get.length = 0;
    expect((await store.listClaims()).map((r) => r.id)).toEqual(["RM-0412"]);
    expect(calls.get.map((c) => c.pathname)).toEqual(["index.json"]);
  });

  it("retries the index write when another instance changed it in between", async () => {
    const store = blobStore("tok");
    await store.putClaim(sampleClaim({ id: "RM-0001" }));
    // Another instance adds RM-0002 between our read of index.json and our write of it.
    const { put } = await import("@vercel/blob");
    const real = vi.mocked(put).getMockImplementation()!;
    let raced = false;
    vi.mocked(put).mockImplementation(async (pathname, body, options) => {
      if (pathname === "index.json" && !raced) {
        raced = true;
        const theirs = JSON.parse(blobs.get("index.json")!.body.toString());
        theirs.claims.push({ ...theirs.claims[0], id: "RM-0002" });
        await real("index.json", JSON.stringify(theirs), { access: "private", allowOverwrite: true });
      }
      return real(pathname, body, options);
    });
    await store.putClaim(sampleClaim({ id: "RM-0003" }));
    vi.mocked(put).mockImplementation(real);
    expect((await store.listClaims()).map((r) => r.id).sort()).toEqual(["RM-0001", "RM-0002", "RM-0003"]);
  });

  it("adds a claim's index row before its file, counting the limit again on the index another instance changed", async () => {
    const store = blobStore("tok");
    await store.addClaim(sampleClaim({ id: "RM-0001" }), () => null);
    expect(calls.put.map((c) => c.pathname)).toEqual(["index.json", "claims/RM-0001.json"]);
    // Another instance adds RM-0002 between our read of index.json and our write of it: the retry sees two rows.
    const { put } = await import("@vercel/blob");
    const real = vi.mocked(put).getMockImplementation()!;
    let raced = false;
    vi.mocked(put).mockImplementation(async (pathname, body, options) => {
      if (pathname === "index.json" && !raced) {
        raced = true;
        const theirs = JSON.parse(blobs.get("index.json")!.body.toString());
        theirs.claims.push({ ...theirs.claims[0], id: "RM-0002" });
        await real("index.json", JSON.stringify(theirs), { access: "private", allowOverwrite: true });
      }
      return real(pathname, body, options);
    });
    const seen: number[] = [];
    const refusal = await store.addClaim(sampleClaim({ id: "RM-0003" }), (rows) => (seen.push(rows.length), rows.length >= 2 ? "full" : null));
    vi.mocked(put).mockImplementation(real);
    expect(seen).toEqual([1, 2]);
    expect(refusal).toBe("full");
    expect((await store.listClaims()).map((r) => r.id).sort()).toEqual(["RM-0001", "RM-0002"]);
    expect(blobs.has("claims/RM-0003.json")).toBe(false);
  });

  it("updates a claim only over the copy it read, re-running the change when another instance wrote first", async () => {
    const store = blobStore("tok");
    await store.putClaim(sampleClaim({ decision: "held" }));
    const { put } = await import("@vercel/blob");
    const real = vi.mocked(put).getMockImplementation()!;
    let raced = false;
    vi.mocked(put).mockImplementation(async (pathname, body, options) => {
      if (pathname === "claims/RM-0412.json" && !raced) {
        raced = true;
        await real(pathname, JSON.stringify(sampleClaim({ decision: "rejected" })), { access: "private", allowOverwrite: true });
      }
      return real(pathname, body, options);
    });
    const seen: string[] = [];
    const saved = await store.updateClaim("RM-0412", (c) => {
      seen.push(c.decision);
      return c.decision === "held" ? { ...c, decision: "paid" } : null;
    });
    vi.mocked(put).mockImplementation(real);
    expect(seen).toEqual(["held", "rejected"]);
    expect(saved).toBeNull();
    expect((await store.getClaim("RM-0412"))?.decision).toBe("rejected");
    expect(await store.updateClaim("RM-9999", (c) => c)).toBeNull();
  });

  it("counts model calls in one private file per UTC day, over the copy it read, and writes nothing at the limit", async () => {
    const store = blobStore("tok");
    expect(await store.takeUsage("2026-11-07", "vision", 2)).toBe(true);
    // Another instance counts a call between our read and our write: ours is retried on top of theirs.
    const { put } = await import("@vercel/blob");
    const real = vi.mocked(put).getMockImplementation()!;
    let raced = false;
    vi.mocked(put).mockImplementation(async (pathname, body, options) => {
      if (pathname === "usage/2026-11-07.json" && !raced) {
        raced = true;
        await real(pathname, JSON.stringify({ vision: 2, draft: 0 }), { access: "private", allowOverwrite: true });
      }
      return real(pathname, body, options);
    });
    // Their write filled the limit, so the retry counts nothing.
    expect(await store.takeUsage("2026-11-07", "vision", 2)).toBe(false);
    vi.mocked(put).mockImplementation(real);
    calls.put.length = 0;
    expect(await store.takeUsage("2026-11-07", "vision", 2)).toBe(false);
    expect(calls.put).toEqual([]);
    expect(await store.takeUsage("2026-11-07", "draft", 2)).toBe(true);
    expect(await store.getUsage("2026-11-07")).toEqual({ vision: 2, draft: 1 });
    expect(blobs.get("usage/2026-11-07.json")?.access).toBe("private");
    expect(calls.put.at(-1)?.options).toMatchObject({ ifMatch: expect.any(String), contentType: "application/json" });
  });

  it("returns null for missing or malformed ids", async () => {
    const store = blobStore("tok");
    expect(await store.getClaim("RM-9999")).toBeNull();
    expect(await store.getClaim("../x")).toBeNull();
    expect(await store.listClaims()).toEqual([]);
  });
});
