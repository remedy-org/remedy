import { BlobPreconditionFailedError, get, put } from "@vercel/blob";
import type { z } from "zod";
import { Claim, Recall } from "../types";
import { bump, ClaimIndex, completeRows, insert, isValidClaimId, isValidRecallId, NO_USAGE, paths, RecallIndex, summarize, summarizeRecall, upsert, upsertRecall, Usage, type IndexRow, type Store } from "./store";

// Production store: Vercel Blob, private access (the store itself must be created as private).
export function blobStore(token: string): Store {
  // useCache: false so a claim page never shows a stale decision from the CDN.
  async function read(pathname: string, useCache = false) {
    const res = await get(pathname, { access: "private", token, useCache });
    if (!res || res.statusCode !== 200) return null;
    // A compressed response carries a weak ETag (W/"…") with the same hash; ifMatch only accepts the strong form.
    return { data: Buffer.from(await new Response(res.stream).arrayBuffer()), etag: res.blob.etag.replace(/^W\//, "") };
  }

  async function readJson<S extends z.ZodType>(pathname: string, schema: S): Promise<z.infer<S> | null> {
    const res = await read(pathname);
    return res ? schema.parse(JSON.parse(res.data.toString("utf8"))) : null;
  }

  async function write(pathname: string, body: string | Buffer, contentType: string, ifMatch?: string) {
    await put(pathname, body, { access: "private", token, contentType, allowOverwrite: true, ...(ifMatch ? { ifMatch } : {}) });
  }

  // Serverless instances can write an index at the same time: write only if it hasn't changed since we read it.
  // A change that returns null writes nothing (false).
  async function updateJson<S extends z.ZodType>(pathname: string, schema: S, empty: z.infer<S>, change: (index: z.infer<S>) => z.infer<S> | null) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const current = await read(pathname);
      const next = change(current ? schema.parse(JSON.parse(current.data.toString("utf8"))) : empty);
      if (next === null) return false;
      try {
        await write(pathname, JSON.stringify(next), "application/json", current?.etag);
        return true;
      } catch (e) {
        if (!(e instanceof BlobPreconditionFailedError)) throw e;
      }
    }
    throw new Error(`${pathname} kept changing under us; gave up after 5 tries`);
  }
  const updateIndex = (change: (index: ClaimIndex) => ClaimIndex | null) => updateJson(paths.index, ClaimIndex, { claims: [] }, change);
  const getClaim = async (id: string) => (isValidClaimId(id) ? readJson(paths.claim(id), Claim) : null);

  return {
    getRecall: async (id) => (isValidRecallId(id) ? readJson(paths.recall(id), Recall) : null),
    async putRecall(recall) {
      const parsed = Recall.parse(recall);
      // Index first: a slug clash must fail before the recall file is written.
      await updateJson(paths.recallIndex, RecallIndex, { recalls: [] }, (index) => upsertRecall(index, summarizeRecall(parsed)));
      await write(paths.recall(parsed.id), JSON.stringify(parsed), "application/json");
    },
    listRecalls: async () => ((await readJson(paths.recallIndex, RecallIndex)) ?? { recalls: [] }).recalls,
    getClaim,
    async putClaim(claim) {
      await write(paths.claim(claim.id), JSON.stringify(Claim.parse(claim)), "application/json");
      await updateIndex((index) => upsert(index, summarize(claim)));
    },
    async addClaim<R>(claim: Claim, refuse: (rows: IndexRow[]) => R | null) {
      const parsed = Claim.parse(claim);
      let refusal: R | null = null;
      // Index first: a start that's refused, or loses to contention, writes no claim file.
      await updateIndex((index) => ((refusal = refuse(index.claims)) === null ? insert(index, summarize(parsed)) : null));
      if (refusal === null) await write(paths.claim(parsed.id), JSON.stringify(parsed), "application/json");
      return refusal;
    },
    // The webhook, the console and the claim page can save one claim at once: write only over the copy we read.
    async updateClaim(id, change) {
      if (!isValidClaimId(id)) return null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const current = await read(paths.claim(id));
        if (!current) return null;
        const next = change(Claim.parse(JSON.parse(current.data.toString("utf8"))));
        if (!next) return null;
        try {
          await write(paths.claim(id), JSON.stringify(Claim.parse(next)), "application/json", current.etag);
        } catch (e) {
          if (!(e instanceof BlobPreconditionFailedError)) throw e;
          continue;
        }
        await updateIndex((index) => upsert(index, summarize(next)));
        return next;
      }
      throw new Error(`claim ${id} kept changing under us; gave up after 5 tries`);
    },
    listClaims: async () => completeRows(((await readJson(paths.index, ClaimIndex)) ?? { claims: [] }).claims, getClaim, updateIndex),
    putPhoto: async (key, jpeg) => write(paths.photo(key), jpeg, "image/jpeg"),
    // Photos never change once written, so the CDN copy is fine.
    getPhoto: async (key) => (await read(paths.photo(key), true))?.data ?? null,
    getUsage: async (day) => (await readJson(paths.usage(day), Usage)) ?? NO_USAGE,
    takeUsage: async (day, kind, limit) => updateJson(paths.usage(day), Usage, NO_USAGE, (usage) => bump(usage, kind, limit)),
  };
}
