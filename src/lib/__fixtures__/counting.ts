import type { Store } from "../store";

// Test-only: wraps a store and counts the calls that reach it. On the blob store each read below is one get(), a
// Simple Operation when it misses the CDN cache (all but photos read past it); each write is one or more put()s,
// Advanced Operations. Wrap it inside withRecallCache to count only what the cache lets through.
const READS = new Set(["getRecall", "listRecalls", "getClaim", "listClaims", "getUsage", "getPhoto"]);

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
      (...args: unknown[]) => {
        counts.calls[name] = (counts.calls[name] ?? 0) + 1;
        if (READS.has(name)) counts.reads++;
        else counts.writes++;
        return (fn as (...a: unknown[]) => unknown)(...args);
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
