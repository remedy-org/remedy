import "server-only";
import { toDrawerClaim } from "@/app/console/_lib/drawer";
import { ledgerOf, toRow } from "@/app/console/_lib/view";
import { demoRecall } from "@/lib/demo/kikea";
import { buildSeedClaims, SEED_PHOTO_PREFIX, SEED_PHOTOS } from "@/lib/demo/seed";
import { summarize } from "@/lib/store/store";
import type { ClaimsGridPreviewProps, PreviewRow } from "./ClaimsGridPreview";

// The homepage's console preview, built on the server from the same seeded sample claims every workspace starts with
// (lib/demo/seed.ts, seed 27071): real stored model answers, the app's own rule, made-up PayPal accounts, never paid.
// No store, no network: buildSeedClaims is pure. Photos are the public sample photos, through Next's image optimizer.

// A fixed "now", so the preview's times and ids don't change between builds.
const NOW = new Date("2026-11-07T09:00:00.000Z");
// The held claim whose evidence the preview opens: the model couldn't tell if both photos show the same item.
export const PREVIEW_OPEN_ID = "RM-9629";
// Enough rows to fill the frame; the ledger and tab counts still cover all 40.
const SHOWN = 14;

const image = (key: string, w: 96 | 256 | 828) => `/_next/image?url=${encodeURIComponent(`/demo/${key.slice(SEED_PHOTO_PREFIX.length)}`)}&w=${w}&q=75`;

export function previewProps(height = 560): ClaimsGridPreviewProps {
  const recall = demoRecall(new Date(NOW.getTime() - 3 * 86_400_000));
  // The hashes only feed the duplicate-photo check, which seeded claims never run.
  const hashes = Object.fromEntries(SEED_PHOTOS.map((name) => [name, "0000000000000000"]));
  const claims = buildSeedClaims({ recall, now: NOW, hashes });
  const all = claims.map((c) => toRow(summarize(c), recall, (key) => ({ thumb: image(key, 96), large: image(key, 256) })));
  const open = claims.find((c) => c.id === PREVIEW_OPEN_ID);
  // The newest few, plus the open claim and one of each outcome (phones show paid, held, rejected and blocked).
  const wanted = new Set(all.slice(0, SHOWN).map((r) => r.id));
  wanted.add(PREVIEW_OPEN_ID);
  for (const d of ["paid", "held", "rejected", "blocked"] as const) if (!all.some((r) => wanted.has(r.id) && r.decision === d)) wanted.add(all.find((r) => r.decision === d)?.id ?? "");
  const rows: PreviewRow[] = all
    .filter((r) => wanted.has(r.id))
    .map((r) => (r.id === PREVIEW_OPEN_ID && open ? { ...r, evidence: { ...toDrawerClaim(open, recall), photos: open.photos.map((p) => image(p.key, 828)) } } : r));
  const counts = { all: all.length, paid: 0, held: 0, rejected: 0, blocked: 0, pending: 0 };
  for (const r of all) counts[r.decision]++;
  return { rows, openId: PREVIEW_OPEN_ID, height, ledger: ledgerOf(all, recall), counts };
}
