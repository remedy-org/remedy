import { join } from "node:path";
import { DEMO_RECALL_ID, DEMO_SLUG } from "../demo/kikea";
import { env } from "../env";
import { RecallSlug } from "../types";
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

// When each store last read recalls.json fresh for a slug it didn't know. Unknown slugs (typos, crawlers) would
// otherwise each cost a read.
const lastMiss = new WeakMap<Store, number>();
const MISS_RECHECK_MS = 10_000;

// /r/<slug> lookups. Reads recalls.json, then the one recall, both through the recall cache. A slug the cached list
// doesn't have is looked up fresh, so a recall just published on another instance opens at once, but at most once
// per MISS_RECHECK_MS per instance: a recall published since opens within that.
export async function getRecallBySlug(slug: string, store: Store = getStore(), now = Date.now()) {
  if (!RecallSlug.safeParse(slug).success) return null;
  // The judges' demo recall: the app store keeps it in memory (lib/demo withDemoRecall), so its pages read no recalls.json.
  if (slug === DEMO_SLUG) return store.getRecall(DEMO_RECALL_ID);
  const bySlug = (rows: RecallSummary[]) => rows.find((r) => r.slug === slug);
  let row = bySlug(await store.listRecalls());
  if (!row && now - (lastMiss.get(store) ?? -Infinity) >= MISS_RECHECK_MS) {
    lastMiss.set(store, now);
    row = bySlug(await store.listRecalls({ fresh: true }));
  }
  return row ? store.getRecall(row.id) : null;
}
