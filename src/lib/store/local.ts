import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { z } from "zod";
import { Claim, Recall } from "../types";
import { bump, ClaimIndex, isValidClaimId, isValidRecallId, NO_USAGE, paths, RecallIndex, summarize, summarizeRecall, upsert, upsertRecall, Usage, type Store } from "./store";

// Dev store: the same layout as the blob store, as files under `dir` (data/, git-ignored).
export function localStore(dir: string): Store {
  const file = (rel: string) => join(dir, rel);

  async function read(rel: string): Promise<Buffer | null> {
    try {
      return await readFile(file(rel));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }

  async function readJson<S extends z.ZodType>(rel: string, schema: S): Promise<z.infer<S> | null> {
    const buf = await read(rel);
    return buf ? schema.parse(JSON.parse(buf.toString("utf8"))) : null;
  }

  // Write then rename, so a crash never leaves half a JSON file.
  async function write(rel: string, data: string | Buffer) {
    await mkdir(dirname(file(rel)), { recursive: true });
    const tmp = `${file(rel)}.${process.pid}.tmp`;
    await writeFile(tmp, data);
    await rename(tmp, file(rel));
  }

  // One process, so a promise chain is enough to stop two index updates interleaving. A change that returns null
  // writes nothing (false).
  let indexLock: Promise<unknown> = Promise.resolve();
  function updateJson<S extends z.ZodType>(rel: string, schema: S, empty: z.infer<S>, change: (index: z.infer<S>) => z.infer<S> | null) {
    const next = indexLock.then(async () => {
      const changed = change((await readJson(rel, schema)) ?? empty);
      if (changed === null) return false;
      await write(rel, JSON.stringify(changed, null, 2));
      return true;
    });
    indexLock = next.catch(() => {});
    return next;
  }
  const updateIndex = (change: (index: ClaimIndex) => ClaimIndex) => updateJson(paths.index, ClaimIndex, { claims: [] }, change);

  async function putClaim(claim: Claim) {
    await write(paths.claim(claim.id), JSON.stringify(Claim.parse(claim), null, 2));
    await updateIndex((index) => upsert(index, summarize(claim)));
  }

  // The same chain for claim updates: each one reads the claim only after the one before it has saved.
  let claimLock: Promise<unknown> = Promise.resolve();
  function updateClaim(id: string, change: (claim: Claim) => Claim | null) {
    const next = claimLock.then(async () => {
      const claim = isValidClaimId(id) ? await readJson(paths.claim(id), Claim) : null;
      const changed = claim && change(claim);
      if (changed) await putClaim(changed);
      return changed || null;
    });
    claimLock = next.catch(() => {});
    return next;
  }

  return {
    getRecall: async (id) => (isValidRecallId(id) ? readJson(paths.recall(id), Recall) : null),
    async putRecall(recall) {
      const parsed = Recall.parse(recall);
      // Index first: a slug clash must fail before the recall file is written.
      await updateJson(paths.recallIndex, RecallIndex, { recalls: [] }, (index) => upsertRecall(index, summarizeRecall(parsed)));
      await write(paths.recall(parsed.id), JSON.stringify(parsed, null, 2));
    },
    listRecalls: async () => ((await readJson(paths.recallIndex, RecallIndex)) ?? { recalls: [] }).recalls,
    getClaim: async (id) => (isValidClaimId(id) ? readJson(paths.claim(id), Claim) : null),
    putClaim,
    updateClaim,
    listClaims: async () => ((await readJson(paths.index, ClaimIndex)) ?? { claims: [] }).claims,
    putPhoto: async (key, jpeg) => write(paths.photo(key), jpeg),
    getPhoto: async (key) => read(paths.photo(key)),
    getUsage: async (day) => (await readJson(paths.usage(day), Usage)) ?? NO_USAGE,
    takeUsage: async (day, kind, limit) => updateJson(paths.usage(day), Usage, NO_USAGE, (usage) => bump(usage, kind, limit)),
  };
}
