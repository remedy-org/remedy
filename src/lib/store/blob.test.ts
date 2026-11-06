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

    expect([...blobs.keys()].sort()).toEqual(["claims/RM-0412.json", "index.json", "photos/RM-0412/1.jpg", "recalls/27-071.json"]);
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

  it("returns null for missing or malformed ids", async () => {
    const store = blobStore("tok");
    expect(await store.getClaim("RM-9999")).toBeNull();
    expect(await store.getClaim("../x")).toBeNull();
    expect(await store.listClaims()).toEqual([]);
  });
});
