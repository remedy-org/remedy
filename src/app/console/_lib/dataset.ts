import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { datasetClaim, datasetPhotoFile, demoDataset, isDatasetId } from "@/lib/demo/dataset";
import { summarize, type ClaimSummary, type Store } from "@/lib/store/store";

// The console's store: the app's store with the demo recall's claims read from the dataset in memory (lib/demo/dataset.ts),
// never from the store. Rows an earlier seed wrote (seeded) are never listed, and a stored claim under one of the
// dataset's ids gives way to the dataset's, so every company sees the seven claims the homepage shows, on any store,
// with no reseed. The dataset's photos come from public/demo. Writes to a dataset claim are refused: a company's
// decision on one is kept in its own browser (starter.ts).

/** The rows the console lists from: the dataset's claims and every stored claim but seeded ones, newest first. */
export const withDatasetRows = (rows: ClaimSummary[]): ClaimSummary[] =>
  [...demoDataset().claims.map(summarize), ...rows.filter((r) => !r.seeded && !isDatasetId(r.id))].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

// A path rooted in public/demo, so the build traces only the demo photos (next.config.ts includes them).
const readDemoPhoto = (name: string) => readFile(join(process.cwd(), "public", "demo", name)).catch(() => null);

const fixed = (id: string) => new Error(`${id} is a demo claim: its record never changes`);

export function withDataset(store: Store): Store {
  return {
    ...store,
    async listClaims() {
      return withDatasetRows(await store.listClaims());
    },
    // An earlier seed's claim opens no more than it lists.
    async getClaim(id) {
      const c = datasetClaim(id);
      if (c) return structuredClone(c);
      const stored = await store.getClaim(id);
      return stored?.seeded ? null : stored;
    },
    async getPhoto(key) {
      const name = datasetPhotoFile(key);
      return name ? readDemoPhoto(name) : store.getPhoto(key);
    },
    async putClaim(claim) {
      if (isDatasetId(claim.id)) throw fixed(claim.id);
      return store.putClaim(claim);
    },
    async updateClaim(id, change) {
      if (isDatasetId(id)) throw fixed(id);
      return store.updateClaim(id, change);
    },
    async reindexClaim(claim) {
      return isDatasetId(claim.id) ? false : store.reindexClaim(claim);
    },
  };
}
