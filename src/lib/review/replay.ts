import { createHash } from "node:crypto";
import type { PayoutStatus } from "../paypal/payouts";
import type { CheckSpec, Verdict } from "../types";
import recorded from "./replay.json";

type Vars = Record<string, string | undefined>;

// Review replay (REMEDY_REVIEW_REPLAY=1): a local review server answers the photo check and PayPal Payouts itself, so
// first-time testers see real outcomes without OpenAI or PayPal credentials. PayPal login is untouched (testers use
// scripts/dev-session.ts). Photos the eval ran get the model's recorded answer (replay.json, from
// eval/out/runs/spike2-gpt-6.1-sol-r1.json via npm run demo:assets); any other photo gets an unsure answer, so it is
// held for a person. Payouts are made-up sandbox batches that settle a few seconds after they're sent.

/** Why replay stays off despite REMEDY_REVIEW_REPLAY=1, or null when it may run. Off anywhere it could touch production:
 * on Vercel, against a real PayPal host (an unset PAYPAL_API_BASE means PayPal's), or with the shared Blob store. */
export function replayRefusal(e: Vars = process.env): string | null {
  if (e.VERCEL) return "VERCEL is set";
  if (e.BLOB_READ_WRITE_TOKEN) return "BLOB_READ_WRITE_TOKEN is set (the shared store)";
  if (!e.PAYPAL_API_BASE) return "PAYPAL_API_BASE is unset, so it would be PayPal's";
  let host: string;
  try {
    host = new URL(e.PAYPAL_API_BASE).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return "PAYPAL_API_BASE isn't a URL";
  }
  if (host === "paypal.com" || host.endsWith(".paypal.com")) return `PAYPAL_API_BASE is PayPal (${host})`;
  return null;
}

/** Whether this request runs on replay. Read on every call, like env(). */
export const reviewReplay = (e: Vars = process.env) => e.REMEDY_REVIEW_REPLAY === "1" && replayRefusal(e) === null;

/** The one startup line (src/instrumentation.ts), or null when REMEDY_REVIEW_REPLAY isn't asked for. */
export function replayNotice(e: Vars = process.env): string | null {
  if (e.REMEDY_REVIEW_REPLAY !== "1") return null;
  const refusal = replayRefusal(e);
  return refusal
    ? `[remedy] REMEDY_REVIEW_REPLAY=1 ignored: ${refusal}. Photo checks and payouts call OpenAI and PayPal.`
    : "[remedy] REVIEW REPLAY ON: photo checks replay the eval's recorded answers and PayPal payouts are simulated. No OpenAI or PayPal Payouts call leaves this machine.";
}

const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Recorded {
  case: string;
  model: string;
  code: string;
  photos: { name: string; sha256: string[] }[];
  verdict: Verdict;
}

/** The eval's recorded answer for exactly these photos, in order; the one recorded under this claim's code when the
 * same photos ran under several (c01 and c11 are one photo). */
export function recordedAnswer(images: Buffer[], code: string | null, rows = recorded as Recorded[]): Recorded | null {
  const hashes = images.map(sha256);
  const same = rows.filter((r) => r.photos.length === hashes.length && r.photos.every((p, i) => p.sha256.includes(hashes[i])));
  return same.find((r) => r.code === code) ?? same[0] ?? null;
}

/** A model that can't make the photo out: every check unclear except the screen, so the rule holds it for a person. */
export function unsureAnswer(spec: CheckSpec, code: string | null, photos: number): Verdict {
  return {
    label: { text_seen: null, matches_recalled_product: "unclear", evidence: "A tag may be in the frame, but its writing is too small and soft to read." },
    steps: spec.proof_steps.map((step) => ({ step, status: "unclear", evidence: "The photo doesn't show this clearly enough to confirm it." })),
    challenge_code: code
      ? { text_seen: null, matches: "unclear", evidence: "Something may be hand-written on the tag, but it can't be read character by character." }
      : { text_seen: null, matches: "unclear", evidence: "This claim has no one-time code." },
    same_item_in_all_photos: photos > 1 ? "unclear" : "yes",
    looks_like_photo_of_screen_or_print: "no",
    summary: "The photo is too unclear to confirm the product, the cut or the written code, so a person should look at it.",
  };
}

/** The photo check on replay, shaped like liveDeps' vision: after a 2-4 s wait, like a quick model call. */
export async function replayVision(
  { images, spec, code }: { images: Buffer[]; spec: CheckSpec; code: string | null },
  delayMs = 2000 + Math.random() * 2000,
) {
  const started = Date.now();
  await wait(delayMs);
  const hit = recordedAnswer(images, code);
  const seconds = (Date.now() - started) / 1000;
  return hit
    ? { verdict: hit.verdict, seconds, model: `${hit.model}, recorded answer` }
    : { verdict: unsureAnswer(spec, code, images.length), seconds, model: "no model call" };
}

// Made-up batch ids are PayPal's 13 characters: RPLY, the send time in base 36 (8 characters until 2059) and one random
// one, so any server instance (or a restart) can tell how long ago it was sent without keeping state.
const PREFIX = "RPLY";
export const SETTLE_MS = 5000;
export const isReplayBatch = (batchId: string) => batchId.startsWith(PREFIX) && batchId.length === 13;

/** A sent payout: PayPal's answer to POST /v1/payments/payouts, a PENDING batch. */
export function replayPayout(now = Date.now()): PayoutStatus {
  const random = Math.floor(Math.random() * 36).toString(36);
  return { batchId: (PREFIX + now.toString(36) + random).toUpperCase(), batchStatus: "PENDING" };
}

/** GET /v1/payments/payouts/<id> for a replayed batch: PENDING until SETTLE_MS after it was sent, then SUCCESS. */
export function replayPayoutStatus(batchId: string, now = Date.now()): PayoutStatus {
  const sentAt = parseInt(batchId.slice(PREFIX.length, -1), 36);
  const status = now - sentAt >= SETTLE_MS ? "SUCCESS" : "PENDING";
  const itemId = sha256(Buffer.from(batchId)).slice(0, 13).toUpperCase();
  return { batchId, batchStatus: status, itemId, itemStatus: status };
}
