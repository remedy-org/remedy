import "server-only";
import { toDrawerClaim } from "@/app/console/_lib/drawer";
import { buildReport } from "@/app/console/_lib/report";
import { ledgerOf, toRow, type ClaimRow } from "@/app/console/_lib/view";
import { demoRecall } from "@/lib/demo/kikea";
import { buildSeedClaims, SEED_PHOTO_PREFIX, SEED_PHOTOS } from "@/lib/demo/seed";
import { summarize } from "@/lib/store/store";
import type { Claim, Recall } from "@/lib/types";
import type { ClaimsGridPreviewProps, PreviewRow } from "./ClaimsGridPreview";
import { formatDayET } from "./format";

// The homepage's console preview, built on the server from the seed every workspace starts with (lib/demo/seed.ts,
// seed 27071): real stored model answers, the app's own rule. No store, no network: buildSeedClaims is pure. Photos are
// the seed's public photos, through Next's image optimizer. The grid, the Insights still and the report draft all read
// this one seed, so every number on the homepage agrees.
// The homepage is a picture of the console as a company runs it, so the claims are drawn as live ones (their payouts as
// sent, their photos as fingerprinted). Only the picture: the stored seed stays seeded, and seeded claims never pay.

// A fixed "now", so the preview's times and ids don't change between builds. The seed spreads its claims over the 72
// hours before it, so a day after the recall's date (5 Nov 2026) every claim comes after the recall.
export const PREVIEW_NOW = new Date("2026-11-08T09:00:00.000Z");
// The held claim whose evidence the preview opens: the model couldn't tell if both photos show the same item. Its
// recorded answers are read on the homepage word for word, so it is one whose answers name only what the photos show.
export const PREVIEW_OPEN_ID = "RM-8843";
// The claim the homepage's tour shows arriving: the newest paid claim, already in the preview rows (a test checks
// both). The arrival replays how it came in; it never adds a 41st claim.
export const ARRIVE_ID = "RM-0553";
// The rows the server-drawn still shows before the grid loads: enough to fill the frame. The grid itself holds all 40.
export const STILL_ROWS = 14;
const DECISIONS = ["paid", "held", "rejected", "blocked"] as const;
const PATTERN: (typeof DECISIONS)[number][] = ["paid", "held", "rejected", "paid", "blocked"];

// The panel's tiles are about 170px wide: 384 is their 2x (Next's default image sizes include it).
const image = (key: string, w: 96 | 256 | 384) => `/_next/image?url=${encodeURIComponent(publicPhoto(key))}&w=${w}&q=75`;
const publicPhoto = (key: string) => `/demo/${key.slice(SEED_PHOTO_PREFIX.length)}`;

let cached: { recall: Recall; claims: Claim[] } | null = null;

/** The 40 seeded claims and the demo recall, at PREVIEW_NOW, drawn as live claims. Pure, built once per server process. */
export function previewSeed() {
  if (cached) return cached;
  const recall = demoRecall(new Date(PREVIEW_NOW.getTime() - 3 * 86_400_000));
  // The hashes only feed the duplicate-photo check, which seeded claims never run.
  const hashes = Object.fromEntries(SEED_PHOTOS.map((name) => [name, "0000000000000000"]));
  cached = { recall, claims: buildSeedClaims({ recall, now: PREVIEW_NOW, hashes }).map((c) => ({ ...c, seeded: false })) };
  return cached;
}

export function previewProps(height = 560): ClaimsGridPreviewProps & { rows: PreviewRow[] } {
  const { recall, claims } = previewSeed();
  const all = claims.map((c) => toRow(summarize(c), recall, (key) => ({ thumb: image(key, 96), large: image(key, 256) })));
  const open = claims.find((c) => c.id === PREVIEW_OPEN_ID);
  // Ordered for the shot, decided claims first: the outcomes mixed (paid, the open held claim, rejected, paid,
  // blocked, ...), newest first within each, then the claims still waiting for photos at the foot. The grid keeps this
  // order until a visitor sorts it. Phones pick one of each outcome from these.
  const queues = new Map(DECISIONS.map((d) => [d, all.filter((r) => r.decision === d && r.id !== PREVIEW_OPEN_ID)]));
  if (open) queues.get("held")!.unshift(all.find((r) => r.id === PREVIEW_OPEN_ID)!);
  const picked: ClaimRow[] = [];
  for (let i = 0; DECISIONS.some((d) => queues.get(d)!.length); i++) {
    const next = queues.get(PATTERN[i % PATTERN.length])!.shift();
    if (next) picked.push(next);
  }
  picked.push(...all.filter((r) => r.decision === "pending"));
  const rows: PreviewRow[] = typeset(
    // The evidence still never shows the claim's history, so it isn't sent to the page.
    picked.map((r) => (r.id === PREVIEW_OPEN_ID && open ? { ...r, evidence: { ...toDrawerClaim(open, recall), events: [], photos: open.photos.map((p) => image(p.key, 384)) } } : r)),
  );
  const counts = { all: all.length, paid: 0, held: 0, rejected: 0, blocked: 0, pending: 0 };
  for (const r of all) counts[r.decision]++;
  return { rows, openId: PREVIEW_OPEN_ID, height, ledger: ledgerOf(all, recall), counts };
}

/** The CPSC progress-report draft over the same 40 claims, as /console/report builds it for a live workspace. */
export function reportPreview() {
  const { recall, claims } = previewSeed();
  return { recall, report: typeset(buildReport(claims.map(summarize), recall)), generated: formatDayET(PREVIEW_NOW.toISOString()) };
}

/**
 * Typeset quotes and apostrophes in every string of a value (the seed's reasons, the model's recorded answers): "X" as
 * “X”, can't as can’t. The words stay the model's own; only the marks change, so a quote inside a quote reads right.
 */
export function typeset<T>(value: T): T {
  if (typeof value === "string") return value.replace(/"([^"]*)"/g, "“$1”").replace(/(\w)'(\w)/g, "$1’$2") as T;
  if (Array.isArray(value)) return value.map(typeset) as T;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, typeset(v)])) as T;
  }
  return value;
}
