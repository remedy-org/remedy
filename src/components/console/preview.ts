import "server-only";
import { toDrawerClaim } from "@/app/console/_lib/drawer";
import { buildReport } from "@/app/console/_lib/report";
import { ledgerOf, toRow } from "@/app/console/_lib/view";
import { demoRecall } from "@/lib/demo/kikea";
import { DEMO_CLAIMS, GENUINE } from "@/lib/demo/claims";
import { buildSeedClaims, SEED_PHOTO_PREFIX, SEED_PHOTOS } from "@/lib/demo/seed";
import { summarize } from "@/lib/store/store";
import type { Claim, Recall } from "@/lib/types";
import type { ClaimsGridPreviewProps, PreviewRow } from "./ClaimsGridPreview";
import type { StillClaim } from "./EvidenceStill";
import { formatDay } from "./format";

// The homepage's console preview, built on the server from the claims every workspace starts with (lib/demo/claims.ts,
// built by lib/demo/seed.ts): real stored model answers, the app's own rule. No store, no network: buildSeedClaims is
// pure. Photos are the seed's public photos, through Next's image optimizer. The grid, the Insights still and the report
// draft all read these claims, drawn exactly as the console draws them: Paid only where PayPal paid, Approved where the
// rule passed and nothing was sent.

// A fixed "now" for the report's date and Insights' days: the day after the newest claim (7 Nov 2026), three days after
// the recall's date (5 Nov 2026).
export const PREVIEW_NOW = new Date("2026-11-08T09:00:00.000Z");
// The held claim whose evidence the tour's Evidence step opens, as How it works' console shows it: the model couldn't
// tell if both photos show the same item. Its recorded answers are read on the homepage word for word, so it is one whose
// answers name only what the photos show. Every claim with photos opens on a click.
export const PREVIEW_OPEN_ID = "RM-9629";
// The claim the homepage's tour shows arriving: RM-0442, the genuine claim the hero and How it works stage, the newest
// claim and the one PayPal paid (a test checks both). The arrival replays how it came in; it never adds a claim.
export const ARRIVE_ID = GENUINE.id;
// The rows the server-drawn still shows before the grid loads: every claim.
export const STILL_ROWS = DEMO_CLAIMS.length;

// The panel's tiles are about 170px wide: 384 is their 2x (Next's default image sizes include it).
const image = (key: string, w: 96 | 256 | 384) => `/_next/image?url=${encodeURIComponent(publicPhoto(key))}&w=${w}&q=75`;
const publicPhoto = (key: string) => `/demo/${key.slice(SEED_PHOTO_PREFIX.length)}`;

let cached: { recall: Recall; claims: Claim[] } | null = null;

/** The demo claims and the demo recall, as the console stores them. Pure, built once per server process. */
export function previewSeed() {
  if (cached) return cached;
  const recall = demoRecall(new Date(PREVIEW_NOW.getTime() - 3 * 86_400_000));
  // The hashes only feed the duplicate-photo check: one per photo, so only the repost matches.
  const hashes = Object.fromEntries(SEED_PHOTOS.map((name, i) => [name, (i + 1).toString(16).padStart(16, "0")]));
  cached = { recall, claims: buildSeedClaims({ recall, hashes }) };
  return cached;
}

/** The grid's rows, ledger and counts for a picture of the console. `asConsole` draws the claims exactly as /console
 * does (verdicts, reasons and check names in its words); otherwise the homepage's live drawing and its shorter lines. */
export function previewProps(height = 560, { asConsole = false } = {}): ClaimsGridPreviewProps & { rows: PreviewRow[] } {
  const { recall, claims } = previewSeed();
  // Newest first, as the console sorts its queue. Phones pick one of each outcome from these.
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
