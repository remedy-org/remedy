import type { Claim, Recall } from "../types";
import { DEMO_CLAIMS, TAG_SPOTS } from "./claims";
import { demoRecall } from "./kikea";
import { buildSeedClaims, SEED_PHOTO_PREFIX, SEED_PHOTOS } from "./seed";

// The demo recall and its seven claims (claims.ts), built in memory at request time: the console, Insights, the report
// and the homepage all read these, never a stored copy. A store keeps whatever an earlier seed wrote (claims marked
// seeded, a demo recall with older settings); nothing reads it for the demo recall, so a new deploy needs no reseed and
// a page view writes nothing. Pure: no store, no files.

// The "now" the claims' times are written against (claims.ts): the day after the newest claim (7 Nov 2026), three days
// after the recall's date (5 Nov 2026).
export const DATASET_NOW = new Date("2026-11-08T09:00:00.000Z");
const DAY = 86_400_000;

/**
 * How far the dataset moves forward for a request at `now`: whole UTC days from DATASET_NOW's day to today's, never
 * back. Each claim keeps its offset back from the dataset's "now", so the newest is always yesterday afternoon and the
 * oldest three evenings ago, never before the recall's date; whole days keep every time of day, and a page reads the
 * same all day.
 */
export const datasetShift = (now: number = Date.now()) => Math.max(0, Math.floor(now / DAY) - Math.floor(DATASET_NOW.getTime() / DAY)) * DAY;

/** The dataset's "now" for a request at `now`: DATASET_NOW moved to today (datasetShift). The report's date and the
 * homepage's Insights days read it. */
export const datasetNow = (now: number = Date.now()) => new Date(DATASET_NOW.getTime() + datasetShift(now));

const IDS = new Set(DEMO_CLAIMS.map((d) => d.id));

/** A claim id the dataset holds: the console opens it from memory, whatever a store holds under it. */
export const isDatasetId = (id: string) => IDS.has(id);

let built: { shift: number; recall: Recall; claims: Claim[] } | null = null;

/** The demo recall and its claims, newest first, as of `now` (datasetShift). Built once a day per server process. */
export function demoDataset(now: number = Date.now()): { recall: Recall; claims: Claim[] } {
  const shift = datasetShift(now);
  if (built?.shift === shift) return built;
  const recall = demoRecall(new Date(DATASET_NOW.getTime() - 3 * DAY + shift));
  // The hashes only feed the duplicate-photo check: one per photo, so only the repost matches.
  const hashes = Object.fromEntries(SEED_PHOTOS.map((name, i) => [name, (i + 1).toString(16).padStart(16, "0")]));
  built = { shift, recall, claims: buildSeedClaims({ recall, hashes, shift }) };
  return built;
}

/** The dataset's claim with this id, or null. */
export const datasetClaim = (id: string, now?: number): Claim | null => (IDS.has(id) ? (demoDataset(now).claims.find((c) => c.id === id) ?? null) : null);

/** A dataset photo's file in public/demo, from its store key (seed/k01-1.jpg), or null for any other key. */
export const datasetPhotoFile = (key: string): string | null => {
  if (!key.startsWith(SEED_PHOTO_PREFIX)) return null;
  const name = key.slice(SEED_PHOTO_PREFIX.length);
  return SEED_PHOTOS.includes(name) ? name : null;
};

/** Where the tag is in a dataset claim's photos (TAG_SPOTS): the photo's index and the spot, and its enlarged cut where
 * there is one, or null. */
export function datasetTagSpot(keys: readonly string[]): { photo: number; x: number; y: number; enlarged?: string } | null {
  for (const [i, key] of keys.entries()) {
    const spot = TAG_SPOTS[datasetPhotoFile(key) ?? ""];
    if (spot) return { photo: i, ...spot };
  }
  return null;
}
