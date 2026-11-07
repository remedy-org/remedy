import { join } from "node:path";
import { env } from "../env";
import { blobStore } from "./blob";
import { withRecallCache } from "./cache";
import { localStore } from "./local";
import type { RecallSummary, Store } from "./store";

export type { ClaimSummary, RecallSummary, Store } from "./store";

let store: Store | undefined;

// Vercel Blob when a token is set, else local files under data/. Recall reads go through this instance's recall
// cache (cache.ts) either way.
export function getStore(): Store {
  if (!store) {
    const token = env().BLOB_READ_WRITE_TOKEN;
    store = withRecallCache(token ? blobStore(token) : localStore(join(process.cwd(), "data")));
  }
  return store;
}

// /r/<slug> lookups. Reads recalls.json, then the one recall, both through the recall cache. A slug the cached list
// doesn't have is looked up fresh, so a recall just published on another instance opens at once.
export async function getRecallBySlug(slug: string, store: Store = getStore()) {
  const bySlug = (rows: RecallSummary[]) => rows.find((r) => r.slug === slug);
  const row = bySlug(await store.listRecalls()) ?? bySlug(await store.listRecalls({ fresh: true }));
  return row ? store.getRecall(row.id) : null;
}
