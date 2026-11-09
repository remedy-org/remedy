import "server-only";
import { toDrawerClaim } from "@/app/console/_lib/drawer";
import { buildReport } from "@/app/console/_lib/report";
import { ledgerOf, toRow } from "@/app/console/_lib/view";
import { demoRecall } from "@/lib/demo/kikea";
import { buildSeedClaims, SEED_PHOTO_PREFIX, SEED_PHOTOS } from "@/lib/demo/seed";
import { summarize } from "@/lib/store/store";
import type { Claim, Recall } from "@/lib/types";
import type { ClaimsGridPreviewProps, PreviewRow } from "./ClaimsGridPreview";
import type { StillClaim } from "./EvidenceStill";
import { formatDay } from "./format";

// The homepage's console preview, built on the server from the seed every workspace starts with (lib/demo/seed.ts,
// seed 27071): real stored model answers, the app's own rule. No store, no network: buildSeedClaims is pure. Photos are
// the seed's public photos, through Next's image optimizer. The grid, the Insights still and the report draft all read
// this one seed, so every number on the homepage agrees.
// The homepage is a picture of the console as a company runs it, so the claims are drawn as live ones (their payouts as
// sent, their photos as fingerprinted). Only the picture: the stored seed stays seeded, and seeded claims never pay.

// A fixed "now", so the preview's times and ids don't change between builds. The seed spreads its claims over the 72
// hours before it, so a day after the recall's date (5 Nov 2026) every claim comes after the recall.
export const PREVIEW_NOW = new Date("2026-11-08T09:00:00.000Z");
// The held claim whose evidence the tour's Evidence step opens, the newest held one, as How it works' console shows it:
// the model couldn't tell if both photos show the same item. Its recorded answers are read on the homepage word for
// word, so it is one whose answers name only what the photos show. Every claim with photos opens on a click.
export const PREVIEW_OPEN_ID = "RM-9629";
// The claim the homepage's tour shows arriving: the newest paid claim, already in the preview rows (a test checks
// both). The arrival replays how it came in; it never adds a 41st claim. In the picture it is the newest claim of all,
// so it lands at the top of the queue (arrived(), below).
export const ARRIVE_ID = "RM-0553";
// The rows the server-drawn still shows before the grid loads: enough to fill the frame. The grid itself holds all 40.
export const STILL_ROWS = 14;

// The panel's tiles are about 170px wide: 384 is their 2x (Next's default image sizes include it).
const image = (key: string, w: 96 | 256 | 384) => `/_next/image?url=${encodeURIComponent(publicPhoto(key))}&w=${w}&q=75`;
const publicPhoto = (key: string) => `/demo/${key.slice(SEED_PHOTO_PREFIX.length)}`;

const cached = new Map<boolean, { recall: Recall; claims: Claim[] }>();

/** The 40 seeded claims and the demo recall, at PREVIEW_NOW, drawn as live claims (the homepage), or as the console
 * draws them (`asConsole`: the sign-in page's picture of the console it opens, starter claims approved and not sent).
 * Pure, built once per server process. */
export function previewSeed(asConsole = false) {
  const hit = cached.get(asConsole);
  if (hit) return hit;
  const recall = demoRecall(new Date(PREVIEW_NOW.getTime() - 3 * 86_400_000));
  // The hashes only feed the duplicate-photo check, which seeded claims never run.
  const hashes = Object.fromEntries(SEED_PHOTOS.map((name) => [name, "0000000000000000"]));
  const claims = buildSeedClaims({ recall, now: PREVIEW_NOW, hashes });
  // On the homepage the seed's one payout still settling (its newest) has settled, so the claim the tour shows arriving
  // lands as Paid, under the Paid tab, as every other paid claim there: one word for one state.
  const live = (c: Claim): Claim => ({ ...c, seeded: false, ...(c.payout?.status === "PENDING" && { payout: { ...c.payout, status: "SUCCESS" } }) });
  const timed = claims.map((c) => (c.id === ARRIVE_ID ? arrived(c, PREVIEW_NOW) : c));
  const built = { recall, claims: asConsole ? timed : timed.map(live) };
  cached.set(asConsole, built);
  return built;
}

/**
 * The arriving claim as the newest of all: its photos in and paid in the minute before the picture's now, its code issued
 * 45 s before the photos, so it is filed after the two claims still waiting for photos and lands at the top of the queue.
 * Every moment after the photos keeps its spacing (the photo check's and PayPal's times are the claim's own).
 */
function arrived(c: Claim, now: Date): Claim {
  const times = [...c.events.map((e) => Date.parse(e.at)), c.payout ? Date.parse(c.payout.updatedAt) : 0];
  const photosAt = Date.parse(c.events.find((e) => e.type === "photos_received")?.at ?? c.createdAt);
  const shift = now.getTime() - 20_000 - Math.max(...times);
  const filed = photosAt + shift - 45_000;
  const iso = (t: number) => new Date(t).toISOString();
  const early = new Set(["created", "code_issued"]);
  return {
    ...c,
    createdAt: iso(filed),
    captureSession: c.captureSession && { ...c.captureSession, expiresAt: iso(filed + 15_000 + 10 * 60_000) },
    events: c.events.map((e) => ({ ...e, at: early.has(e.type) ? iso(filed + (e.type === "code_issued" ? 15_000 : 0)) : iso(Date.parse(e.at) + shift) })),
    payout: c.payout && { ...c.payout, updatedAt: iso(Date.parse(c.payout.updatedAt) + shift) },
  };
}

/** The grid's rows, ledger and counts for a picture of the console. `asConsole` draws the claims exactly as /console
 * does (verdicts, reasons and check names in its words); otherwise the homepage's live drawing and its shorter lines. */
export function previewProps(height = 560, { asConsole = false } = {}): ClaimsGridPreviewProps & { rows: PreviewRow[] } {
  const { recall, claims } = previewSeed(asConsole);
  // Newest first, as the console sorts its queue: the seed gives its claims out in time so the outcomes come mixed
  // (lib/demo/seed.ts spread), the two still waiting for photos on top. Phones pick one of each outcome from these.
  const all = claims
    .map((c) => toRow(summarize(c), recall, (key) => ({ thumb: image(key, 96), large: image(key, 256) })))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const rows: PreviewRow[] = typeset(
    all.map((r) => {
      const row = asConsole ? r : { ...r, note: shortNote(r.note), bars: r.bars?.map((b) => ({ ...b, label: CHECK_NAME[b.id]?.(r.code ?? "") ?? b.label })) ?? null };
      // Every claim with photos carries its evidence, so a visitor who clicks it in the queue opens it (the tour only).
      const claim = asConsole || !r.photoCount ? undefined : claims.find((c) => c.id === r.id);
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

/** A claim's evidence for the homepage, only what the still draws: its photos, the checks by name (a pre-check that
 * stopped it first), and the model's words only where they held or failed it (the still shows no other quote). */
function evidenceOf(claim: Claim, recall: Recall): StillClaim {
  const d = toDrawerClaim(claim, recall);
  const stopped = d.preChecks
    .filter((p) => p.state === "hold" || p.state === "reject")
    .map((p) => ({ id: p.id, label: p.label, outcome: p.state === "hold" ? ("hold" as const) : ("reject" as const), rule: p.detail, evidence: null }));
  return {
    id: d.id,
    decision: d.decision,
    code: d.code,
    payer: d.payer,
    amount: d.amount,
    sentence: d.sentence,
    review: d.review,
    payout: d.payout && { status: d.payout.status },
    summary: d.summary,
    photos: claim.photos.map((p) => image(p.key, 384)),
    checks: [
      ...stopped,
      ...d.checks.map((c) => ({ id: c.id, label: CHECK_NAME[c.id]?.(d.code) ?? c.label, outcome: c.outcome, rule: c.rule, evidence: c.outcome === "pass" ? null : c.evidence })),
    ],
  };
}

/** The CPSC progress-report draft over the same 40 claims, as /console/report builds it for a live workspace. */
export function reportPreview() {
  const { recall, claims } = previewSeed();
  const daysIn = Math.floor((PREVIEW_NOW.getTime() - Date.parse(recall.recallDate)) / 86_400_000);
  return { recall, report: typeset(buildReport(claims.map(summarize), recall)), generated: formatDay(PREVIEW_NOW.toISOString()), daysIn };
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
