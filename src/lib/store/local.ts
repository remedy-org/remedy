import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { z } from "zod";
import { Claim, Recall } from "../types";
import { ClaimIndex, isValidClaimId, isValidRecallId, paths, summarize, upsert, type Store } from "./store";

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

  // One process, so a promise chain is enough to stop two index updates interleaving.
  let indexLock: Promise<unknown> = Promise.resolve();
  function updateIndex(change: (index: ClaimIndex) => ClaimIndex) {
    const next = indexLock.then(async () => {
      const index = (await readJson(paths.index, ClaimIndex)) ?? { claims: [] };
      await write(paths.index, JSON.stringify(change(index), null, 2));
    });
    indexLock = next.catch(() => {});
    return next;
  }

  return {
    getRecall: async (id) => (isValidRecallId(id) ? readJson(paths.recall(id), Recall) : null),
    putRecall: async (recall) => write(paths.recall(recall.id), JSON.stringify(Recall.parse(recall), null, 2)),
    getClaim: async (id) => (isValidClaimId(id) ? readJson(paths.claim(id), Claim) : null),
    async putClaim(claim) {
      await write(paths.claim(claim.id), JSON.stringify(Claim.parse(claim), null, 2));
      await updateIndex((index) => upsert(index, summarize(claim)));
    },
    listClaims: async () => ((await readJson(paths.index, ClaimIndex)) ?? { claims: [] }).claims,
    putPhoto: async (key, jpeg) => write(paths.photo(key), jpeg),
    getPhoto: async (key) => read(paths.photo(key)),
  };
}
