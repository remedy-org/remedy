import { getStore, type ClaimSummary, type Store } from "../store";
import { ensureDemoData } from "./seed";

export { isDemoAllowed } from "./allowed";
export { DEMO_RECALL_ID, DEMO_SLUG, DEMO_SPEC, demoRecall } from "./kikea";
export { DEMO_SAMPLES, demoSample, type DemoSample, type DemoSampleId } from "./samples";
export { buildSeedClaims, ensureDemoData, SEED_PHOTO_PREFIX } from "./seed";

let seeding: Promise<unknown> | null = null;

// Use in pages and route handlers instead of getStore(). In dev, the first call seeds the Kikea demo recall and its
// sample claims (idempotent). In production, seed once with `npm run seed` against the Blob store.
export async function getAppStore(): Promise<Store> {
  const store = getStore();
  if (process.env.NODE_ENV !== "production") {
    seeding ??= ensureDemoData(store).catch((e) => {
      seeding = null;
      throw e;
    });
    await seeding;
  }
  return store;
}

// The rows preCheck and sendCheck compare against. Seeded claims share a few sample photos and fake accounts, so
// they must not block real or demo claims (the wrong-code sample is c01's photo, which seeded claims use).
export const checkableClaims = (rows: ClaimSummary[]) => rows.filter((r) => !r.seeded);
