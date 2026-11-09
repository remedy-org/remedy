import { getStore, type ClaimSummary, type Store } from "../store";
import { summarizeRecall } from "../store/store";
import { demoDataset } from "./dataset";
import { DEMO_RECALL_ID } from "./kikea";

export { isDemoAllowed, isSandboxBuild } from "./allowed";
export { DEMO_RECALL_ID, DEMO_SLUG, DEMO_SPEC, demoRecall } from "./kikea";
export { DEMO_ROUND_COOKIE, demoRoundCookie, newDemoRound, parseDemoRound } from "./round";
export { DEMO_SAMPLES, demoSample, demoSampleOf, oneClaimChecked, type DemoSample, type DemoSampleId } from "./samples";
export { buildSeedClaims, SEED_PHOTO_PREFIX } from "./seed";

/** The store with the demo recall read from memory (dataset.ts), never from the store: a store an earlier seed wrote keeps
 * that seed's copy, and an empty one has none, yet both open the same recall. Its settings are fixed, so it is never
 * written. Reads only: nothing here writes. */
export function withDemoRecall(store: Store): Store {
  return {
    ...store,
    async getRecall(id, options) {
      return id === DEMO_RECALL_ID ? structuredClone(demoDataset().recall) : store.getRecall(id, options);
    },
    // Oldest first, and the demo recall leads.
    async listRecalls(options) {
      const rows = await store.listRecalls(options);
      return [summarizeRecall(demoDataset().recall), ...rows.filter((r) => r.id !== DEMO_RECALL_ID)];
    },
    async putRecall(recall) {
      if (recall.id === DEMO_RECALL_ID) throw new Error("The demo recall's settings are fixed");
      return store.putRecall(recall);
    },
  };
}

let app: { base: Store; store: Store } | null = null;

// Use in pages and route handlers instead of getStore(). Reading never writes: the demo recall and its claims come from
// memory (dataset.ts), so no store is seeded, in dev or in production.
export async function getAppStore(): Promise<Store> {
  const base = getStore();
  if (app?.base !== base) app = { base, store: withDemoRecall(base) };
  return app.store;
}

// The rows preCheck and sendCheck compare against. Seeded claims share a few sample photos and fake accounts, so
// they must not block real or demo claims.
export const checkableClaims = (rows: ClaimSummary[]) => rows.filter((r) => !r.seeded);
