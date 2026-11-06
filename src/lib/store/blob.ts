import { BlobPreconditionFailedError, get, put } from "@vercel/blob";
import type { z } from "zod";
import { Claim, Recall } from "../types";
import { ClaimIndex, isValidClaimId, isValidRecallId, paths, summarize, upsert, type Store } from "./store";

// Production store: Vercel Blob, private access (the store itself must be created as private).
export function blobStore(token: string): Store {
  // useCache: false so a claim page never shows a stale decision from the CDN.
  async function read(pathname: string, useCache = false) {
    const res = await get(pathname, { access: "private", token, useCache });
    if (!res || res.statusCode !== 200) return null;
    return { data: Buffer.from(await new Response(res.stream).arrayBuffer()), etag: res.blob.etag };
  }

  async function readJson<S extends z.ZodType>(pathname: string, schema: S): Promise<z.infer<S> | null> {
    const res = await read(pathname);
    return res ? schema.parse(JSON.parse(res.data.toString("utf8"))) : null;
  }

  async function write(pathname: string, body: string | Buffer, contentType: string, ifMatch?: string) {
    await put(pathname, body, { access: "private", token, contentType, allowOverwrite: true, ...(ifMatch ? { ifMatch } : {}) });
  }

  // Serverless instances can write index.json at the same time: write only if it hasn't changed since we read it.
  async function updateIndex(change: (index: ClaimIndex) => ClaimIndex) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const current = await read(paths.index);
      const index = current ? ClaimIndex.parse(JSON.parse(current.data.toString("utf8"))) : { claims: [] };
      try {
        await write(paths.index, JSON.stringify(change(index)), "application/json", current?.etag);
        return;
      } catch (e) {
        if (!(e instanceof BlobPreconditionFailedError)) throw e;
      }
    }
    throw new Error("index.json kept changing under us; gave up after 5 tries");
  }

  return {
    getRecall: async (id) => (isValidRecallId(id) ? readJson(paths.recall(id), Recall) : null),
    putRecall: async (recall) => write(paths.recall(recall.id), JSON.stringify(Recall.parse(recall)), "application/json"),
    getClaim: async (id) => (isValidClaimId(id) ? readJson(paths.claim(id), Claim) : null),
    async putClaim(claim) {
      await write(paths.claim(claim.id), JSON.stringify(Claim.parse(claim)), "application/json");
      await updateIndex((index) => upsert(index, summarize(claim)));
    },
    listClaims: async () => ((await readJson(paths.index, ClaimIndex)) ?? { claims: [] }).claims,
    putPhoto: async (key, jpeg) => write(paths.photo(key), jpeg, "image/jpeg"),
    // Photos never change once written, so the CDN copy is fine.
    getPhoto: async (key) => (await read(paths.photo(key), true))?.data ?? null,
  };
}
