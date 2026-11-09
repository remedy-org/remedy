import "server-only";
import { unstable_cache } from "next/cache";
import sharp from "sharp";
import { getAppStore } from "@/lib/demo";
import { datasetClaim, datasetPhotoFile } from "@/lib/demo/dataset";
import type { Claim } from "@/lib/types";
import { withDataset } from "./dataset";

const consoleStore = async () => withDataset(await getAppStore());

// The sizes the console asks for: grid thumbnails (32px at 3x), the hover view, the evidence panel (440px at 2x).
// A fixed set, so the cache holds a few entries per photo, not one per arbitrary width.
export const PHOTO_WIDTHS = [96, 240, 880] as const;
export type PhotoWidth = (typeof PHOTO_WIDTHS)[number];
export const isPhotoWidth = (w: number): w is PhotoWidth => (PHOTO_WIDTHS as readonly number[]).includes(w);

const resize = async (jpeg: Buffer, width: PhotoWidth) =>
  // The data cache keeps JSON.
  (await sharp(jpeg).rotate().resize({ width, withoutEnlargement: true }).jpeg({ quality: width <= 240 ? 72 : 80, mozjpeg: true }).toBuffer()).toString("base64");

/**
 * A photo at a width, as a JPEG. A key names one photo forever (claims never replace their photos), so each key and
 * width is read from the store and resized once, then served from Next's data cache: one Blob read per photo per
 * width, ever. A missing photo throws, so it's never cached as missing. The demo claims' photos (dataset.ts) come from
 * public/demo under a cache of their own, never a photo an earlier seed stored under the same key.
 */
const resized = unstable_cache(
  async (key: string, width: PhotoWidth) => {
    const jpeg = await (await consoleStore()).getPhoto(key);
    if (!jpeg) throw new Error(`photo ${key} not in the store`);
    return resize(jpeg, width);
  },
  ["console-photo-resized-v1"],
);
const resizedDemo = unstable_cache(
  async (key: string, width: PhotoWidth) => {
    const jpeg = await (await consoleStore()).getPhoto(key);
    if (!jpeg) throw new Error(`demo photo ${key} not in public/demo`);
    return resize(jpeg, width);
  },
  ["console-demo-photo-resized-v1"],
);

export async function resizedPhoto(key: string, width: PhotoWidth): Promise<Buffer | null> {
  try {
    return Buffer.from(await (datasetPhotoFile(key) ? resizedDemo : resized)(key, width), "base64");
  } catch {
    return null;
  }
}

/**
 * A claim at a version (its event count, from the index row). A claim file never changes without its event count
 * going up, so the evidence panel reads each version once and walking the queue with ↑/↓ costs no claim reads on a
 * second pass. A missing file throws, so it's never cached as missing. The row's filed time is in the key too: an
 * earlier seed's claims reuse ids, and an older claim must never come back under one. A demo claim (dataset.ts) comes
 * from memory, never through the cache.
 */
const storedAtVersion = unstable_cache(
  async (id: string, version: number, filedAt: string): Promise<Claim> => {
    const claim = await (await consoleStore()).getClaim(id);
    if (!claim) throw new Error(`claim ${id} (version ${version}, filed ${filedAt || "?"}) not readable yet`);
    return claim;
  },
  ["console-claim-at-version-v1"],
);

export const claimAtVersion = async (id: string, version: number, filedAt: string): Promise<Claim> => {
  const demo = datasetClaim(id);
  return demo ? structuredClone(demo) : storedAtVersion(id, version, filedAt);
};
