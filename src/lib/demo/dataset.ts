import type { Claim, Recall } from "../types";
import { DEMO_CLAIMS } from "./claims";
import { demoRecall } from "./kikea";
import { buildSeedClaims, SEED_PHOTO_PREFIX, SEED_PHOTOS } from "./seed";

// The demo recall and its seven claims (claims.ts), built in memory at request time: the console, Insights, the report
// and the homepage all read these, never a stored copy. A store keeps whatever an earlier seed wrote (claims marked
// seeded, a demo recall with older settings); nothing reads it for the demo recall, so a new deploy needs no reseed and
// a page view writes nothing. Pure: no store, no files.

// The day after the newest claim (7 Nov 2026), three days after the recall's date (5 Nov 2026): the report's date and
// Insights' days on the homepage, and the recall's created time everywhere.
export const DATASET_NOW = new Date("2026-11-08T09:00:00.000Z");

const IDS = new Set(DEMO_CLAIMS.map((d) => d.id));

/** A claim id the dataset holds: the console opens it from memory, whatever a store holds under it. */
export const isDatasetId = (id: string) => IDS.has(id);

let built: { recall: Recall; claims: Claim[] } | null = null;

/** The demo recall and its claims, newest first. Built once per server process. */
export function demoDataset(): { recall: Recall; claims: Claim[] } {
  if (built) return built;
  const recall = demoRecall(new Date(DATASET_NOW.getTime() - 3 * 86_400_000));
  // The hashes only feed the duplicate-photo check: one per photo, so only the repost matches.
  const hashes = Object.fromEntries(SEED_PHOTOS.map((name, i) => [name, (i + 1).toString(16).padStart(16, "0")]));
  built = { recall, claims: buildSeedClaims({ recall, hashes }) };
  return built;
}

/** The dataset's claim with this id, or null. */
export const datasetClaim = (id: string): Claim | null => (IDS.has(id) ? (demoDataset().claims.find((c) => c.id === id) ?? null) : null);

/** A dataset photo's file in public/demo, from its store key (seed/c02-1.jpg), or null for any other key. */
export const datasetPhotoFile = (key: string): string | null => {
  if (!key.startsWith(SEED_PHOTO_PREFIX)) return null;
  const name = key.slice(SEED_PHOTO_PREFIX.length);
  return SEED_PHOTOS.includes(name) ? name : null;
};
