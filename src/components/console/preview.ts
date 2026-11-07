import "server-only";
import { toDrawerClaim } from "@/app/console/_lib/drawer";
import { ledgerOf, toRow, type ClaimRow } from "@/app/console/_lib/view";
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
const DECISIONS = ["paid", "held", "rejected", "blocked"] as const;
const PATTERN: (typeof DECISIONS)[number][] = ["paid", "held", "rejected", "paid", "blocked"];

// The panel's tiles are about 170px wide: 384 is their 2x (Next's default image sizes include it).
const image = (key: string, w: 96 | 256 | 384) => `/_next/image?url=${encodeURIComponent(`/demo/${key.slice(SEED_PHOTO_PREFIX.length)}`)}&w=${w}&q=75`;

export function previewProps(height = 560): ClaimsGridPreviewProps {
  const recall = demoRecall(new Date(NOW.getTime() - 3 * 86_400_000));
  // The hashes only feed the duplicate-photo check, which seeded claims never run.
  const hashes = Object.fromEntries(SEED_PHOTOS.map((name) => [name, "0000000000000000"]));
  const claims = buildSeedClaims({ recall, now: NOW, hashes });
  const all = claims.map((c) => toRow(summarize(c), recall, (key) => ({ thumb: image(key, 96), large: image(key, 256) })));
  const open = claims.find((c) => c.id === PREVIEW_OPEN_ID);
  // Curated for the shot, decided claims first: the outcomes mixed (paid, the open held claim, rejected, paid,
  // blocked, ...), newest first within each, then one claim still waiting for photos at the foot. The still grid keeps
  // this order (it doesn't sort). Phones pick one of each outcome from these.
  const queues = new Map(DECISIONS.map((d) => [d, all.filter((r) => r.decision === d && r.id !== PREVIEW_OPEN_ID)]));
  if (open) queues.get("held")!.unshift(all.find((r) => r.id === PREVIEW_OPEN_ID)!);
  const picked: ClaimRow[] = [];
  for (let i = 0; picked.length < SHOWN - 1 && DECISIONS.some((d) => queues.get(d)!.length); i++) {
    const next = queues.get(PATTERN[i % PATTERN.length])!.shift();
    if (next) picked.push(next);
  }
  const waiting = all.find((r) => r.decision === "pending");
  if (waiting) picked.push(waiting);
  const rows: PreviewRow[] = picked.map((r) =>
    r.id === PREVIEW_OPEN_ID && open ? { ...r, evidence: { ...toDrawerClaim(open, recall), photos: open.photos.map((p) => image(p.key, 384)) } } : r,
  );
  const counts = { all: all.length, paid: 0, held: 0, rejected: 0, blocked: 0, pending: 0 };
  for (const r of all) counts[r.decision]++;
  return { rows, openId: PREVIEW_OPEN_ID, height, ledger: ledgerOf(all, recall), counts };
}
