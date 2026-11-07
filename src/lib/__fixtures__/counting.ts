import type { Store } from "../store";

// Test-only: wraps a store and counts the calls that reach it. reads counts the blob store's get()s, the writes' own
// included: each is a Simple Operation when it misses the CDN cache (all but photos read past it). writes counts
// write calls, each one or more put()s (Advanced Operations). Wrap it inside withRecallCache to count only what the
// cache lets through.
const READS = new Set(["getRecall", "listRecalls", "getClaim", "listClaims", "getUsage", "getPhoto"]);
// The get()s a write makes itself on the blob store, when nothing races it: the conditional index or usage writes
// read first, and updateClaim reads the claim before its index. A retry on contention reads again; that isn't counted.
const WRITE_READS: Record<string, number> = { putRecall: 1, putClaim: 1, addClaim: 1, updateClaim: 2, reindexClaim: 1, takeUsage: 1 };

export interface Counts {
  reads: number;
  writes: number;
  // Calls per Store method.
  calls: Record<string, number>;
}

export function countingStore(inner: Store): { store: Store; counts: Counts; reset(): void } {
  const counts: Counts = { reads: 0, writes: 0, calls: {} };
  const store = Object.fromEntries(
    Object.entries(inner).map(([name, fn]) => [
      name,
      async (...args: unknown[]) => {
        counts.calls[name] = (counts.calls[name] ?? 0) + 1;
        if (READS.has(name)) counts.reads++;
        else counts.writes++;
        const result = await (fn as (...a: unknown[]) => Promise<unknown>)(...args);
        // A claim that's missing, or a change that returns null, stops updateClaim after its first read.
        counts.reads += name === "updateClaim" && result === null ? 1 : (WRITE_READS[name] ?? 0);
        return result;
      },
    ]),
  ) as unknown as Store;
  const reset = () => {
    counts.reads = 0;
    counts.writes = 0;
    counts.calls = {};
  };
  return { store, counts, reset };
}
