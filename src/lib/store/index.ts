import { join } from "node:path";
import { env } from "../env";
import { blobStore } from "./blob";
import { localStore } from "./local";
import type { Store } from "./store";

export type { ClaimSummary, RecallSummary, Store } from "./store";

let store: Store | undefined;

// Vercel Blob when a token is set, else local files under data/.
export function getStore(): Store {
  if (!store) {
    const token = env().BLOB_READ_WRITE_TOKEN;
    store = token ? blobStore(token) : localStore(join(process.cwd(), "data"));
  }
  return store;
}

// /r/<slug> lookups. Reads recalls.json, then the one recall.
export async function getRecallBySlug(slug: string, store: Store = getStore()) {
  const row = (await store.listRecalls()).find((r) => r.slug === slug);
  return row ? store.getRecall(row.id) : null;
}
