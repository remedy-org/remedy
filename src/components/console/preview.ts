import "server-only";
import { toDrawerClaim, type DrawerClaim } from "@/app/console/_lib/drawer";
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
  // Ordered for the shot, decided claims first: the outcomes mixed (paid, the open held claim, rejected, paid,
  // blocked, ...), newest first within each, then the claims still waiting for photos at the foot. The grid keeps this
  // order until a visitor sorts it. Phones pick one of each outcome from these.
  const queues = new Map(DECISIONS.map((d) => [d, all.filter((r) => r.decision === d && r.id !== PREVIEW_OPEN_ID)]));
  const open = all.find((r) => r.id === PREVIEW_OPEN_ID);
  if (open) queues.get("held")!.unshift(open);
  const picked: ClaimRow[] = [];
  for (let i = 0; DECISIONS.some((d) => queues.get(d)!.length); i++) {
    const next = queues.get(PATTERN[i % PATTERN.length])!.shift();
    if (next) picked.push(next);
  }
  picked.push(...all.filter((r) => r.decision === "pending"));
  const rows: PreviewRow[] = typeset(
    picked.map((r) => {
      const row = { ...r, note: shortNote(r.note), bars: r.bars?.map((b) => ({ ...b, label: CHECK_NAME[b.id]?.(r.code ?? "") ?? b.label })) ?? null };
      // Every held claim carries its evidence, so a visitor who clicks one in the queue opens it.
      const claim = r.decision === "held" ? claims.find((c) => c.id === r.id) : undefined;
      return claim ? { ...row, evidence: evidenceOf(claim, recall) } : row;
    }),
  );
  const counts = { all: all.length, paid: 0, held: 0, rejected: 0, blocked: 0, pending: 0 };
  for (const r of all) counts[r.decision]++;
  return { rows, openId: PREVIEW_OPEN_ID, height, ledger: ledgerOf(all, recall), counts };
}

// The queue's verdict line, as a reviewer scans it: the reason in a few words. The evidence keeps the full sentence.
const SHORT: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^This PayPal account isn’t verified/, () => "PayPal account not verified"],
  [/^Couldn’t tell if both photos show the same item/, () => "Not sure it’s the same item"],
  [/^Looks like a photo of a screen or a print/, () => "Photo of a screen or a print"],
  [/^Written code reads (\w+); this claim’s code is (\w+)/, (m) => `Code reads ${m[1]}, not ${m[2]}`],
  [/^Photo \d+ was already used in another claim/, () => "Photo already used in another claim"],
];
const shortNote = (note: string | null) => {
  if (!note) return note;
  const typed = typeset(note);
  for (const [re, say] of SHORT) {
    const m = typed.match(re);
    if (m) return say(m);
  }
  return note;
};

// The checks as a recall manager names them, for this recall (the X-VESOLJE pillow: tag, code, cut in half, tag on the
// cut half), instead of the pipeline's ids ("Step 1").
const CHECK_NAME: Record<string, (code: string) => string> = {
  label: () => "Tag shown",
  code: (code) => `Code ${code} matches`,
  same_item: () => "Same item in both photos",
  screen: () => "Real photo (not a screen)",
  step_1: () => "Cut fully in half",
  step_2: () => "Tag on the cut pillow",
};

/** A held claim's evidence for the homepage: its photos, the checks by name, and the model's words only where they
 * held it (the still shows no other quote). The still never shows the claim's history, so it isn't sent to the page. */
function evidenceOf(claim: Claim, recall: Recall): DrawerClaim {
  const d = toDrawerClaim(claim, recall);
  return {
    ...d,
    events: [],
    photos: claim.photos.map((p) => image(p.key, 384)),
    checks: d.checks.map((c) => ({ ...c, label: CHECK_NAME[c.id]?.(d.code) ?? c.label, evidence: c.outcome === "pass" ? null : c.evidence })),
  };
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
