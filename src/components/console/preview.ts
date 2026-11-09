import "server-only";
import { toDrawerClaim } from "@/app/console/_lib/drawer";
import { buildReport } from "@/app/console/_lib/report";
import { ledgerOf, toRow } from "@/app/console/_lib/view";
import { DEMO_CLAIMS, GENUINE } from "@/lib/demo/claims";
import { datasetNow, demoDataset } from "@/lib/demo/dataset";
import { SEED_PHOTO_PREFIX } from "@/lib/demo/seed";
import { summarize } from "@/lib/store/store";
import type { Claim, Recall } from "@/lib/types";
import type { ClaimsGridPreviewProps, PreviewRow } from "./ClaimsGridPreview";
import type { StillClaim } from "./EvidenceStill";
import { formatDay, PART_STATE, recallDays, reportNumber } from "./format";
import { verdictOf } from "./VerdictMark";

// The homepage's console preview, built on the server from the claims every workspace starts with (lib/demo/claims.ts,
// built by lib/demo/dataset.ts, the same claims the console reads): real stored model answers, the app's own rule. No
// store, no network: the dataset is pure. Photos are the seed's public photos, through Next's image optimizer. The grid, the Insights still and the report
// draft all read these claims, drawn exactly as the console draws them: Paid only where PayPal paid, Approved where the
// rule passed and nothing was sent.

// The "now" for the report's date and Insights' days: the dataset's own (dataset.ts datasetNow), the day after its newest
// claim, so the homepage's dates move with the console's.
export const previewNow = () => datasetNow();
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

/** The demo claims and the demo recall, exactly as the console reads them today (dataset.ts). Pure. */
export const previewSeed = (): { recall: Recall; claims: Claim[] } => demoDataset();

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
  // By verdict, as the console's tabs count (lib/payoutWords.ts).
  const counts = { all: all.length, paid: 0, settling: 0, approved: 0, held: 0, rejected: 0, blocked: 0, pending: 0 };
  for (const r of all) counts[verdictOf(r)]++;
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

/** A claim's evidence for the homepage, only what the still draws: its photos, and the five checks by the names the
 * console's panel gives them (fiveRows), each that ran once, with the model's words only where one held or failed it
 * (the still shows no other quote). The finer answers stay in the queue's hover card. */
function evidenceOf(claim: Claim, recall: Recall): StillClaim {
  const d = toDrawerClaim(claim, recall);
  const checks = d.fiveRows
    .filter((r) => !r.unrun && (r.state === "pass" || r.state === "hold" || r.state === "reject"))
    .map((r) => {
      const outcome = r.state as "pass" | "hold" | "reject";
      // The answer that decided it: the first that didn't pass.
      const off = r.parts.find((p) => p.state === outcome) ?? r.parts[0];
      // A check that some answers passed names what is in doubt first, as the panel's row does ("X-VESOLJE tag on the
      // cut pillow: couldn't tell"); the row itself keeps the check's own name.
      const doubted = [...new Set(r.parts.filter((p) => p.state === outcome).map((p) => p.label))];
      const doubt = outcome !== "pass" && r.parts.some((p) => p.state === "pass") && doubted.length ? `${doubted.join(", ")}: ${PART_STATE[outcome]}` : undefined;
      return { id: off?.id ?? `check_${r.n}`, label: r.name, outcome, rule: off?.text ?? "", evidence: outcome === "pass" ? null : (off?.evidence ?? null), doubt };
    });
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
    checks,
  };
}

/** The CPSC progress-report draft over the same claims, as /console/report builds it for a live workspace. */
export function reportPreview() {
  const { recall, claims } = previewSeed();
  const now = previewNow();
  return {
    recall,
    report: typeset(buildReport(claims.map(summarize), recall)),
    generated: formatDay(now.toISOString()),
    daysIn: recallDays(recall.recallDate, now),
    reportNo: reportNumber(recall.recallDate, now),
  };
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
