import type { Recall } from "../types";
import type { RecallSummary, Store } from "./store";

// Recalls change rarely (a company editing its own); claims change all the time and are never cached here. Each
// server instance keeps recalls.json and the recalls it read for ttlMs, so most page views read no recall from the
// store, where every read counts against the Blob plan's monthly operations. The instance's own putRecall clears
// the cache; another instance's edit shows within ttlMs. Paths that pay, or read a recall to change it, pass
// { fresh: true }.
export function withRecallCache(store: Store, { ttlMs = 60_000, now = Date.now }: { ttlMs?: number; now?: () => number } = {}): Store {
  let list: { at: number; rows: RecallSummary[] } | null = null;
  const recalls = new Map<string, { at: number; recall: Recall }>();
  const live = (at: number) => now() - at < ttlMs;

  return {
    ...store,
    // Copies, so a caller that changes what it was given can't change the cache.
    async listRecalls({ fresh = false } = {}) {
      if (!fresh && list && live(list.at)) return structuredClone(list.rows);
      const rows = await store.listRecalls();
      list = { at: now(), rows: structuredClone(rows) };
      return rows;
    },
    // A missing recall isn't kept: one published on another instance opens as soon as it exists.
    async getRecall(id, { fresh = false } = {}) {
      const hit = recalls.get(id);
      if (!fresh && hit && live(hit.at)) return structuredClone(hit.recall);
      const recall = await store.getRecall(id);
      if (recall) recalls.set(id, { at: now(), recall: structuredClone(recall) });
      else recalls.delete(id);
      return recall;
    },
    async putRecall(recall) {
      try {
        await store.putRecall(recall);
      } finally {
        list = null;
        recalls.delete(recall.id);
      }
    },
  };
}
