import { appealReason, canAskForReview, reviewAsked } from "@/lib/appeal";
import { newCode } from "@/lib/codes";
import { isLikelySame } from "@/lib/fingerprint";
import { checkableClaims, demoSample, demoSampleOf, oneClaimChecked } from "@/lib/demo";
import type { DemoSample } from "@/lib/demo";
import { CAPTURE_SESSION_MINUTES, newCaptureSession, newClaimId, newPayoutKey } from "@/lib/ids";
import { claimRefusal, utcDay, type Limits, type Refusal } from "@/lib/limits";
import { PayPalError } from "@/lib/paypal/client";
import type { PayoutStatus } from "@/lib/paypal/payouts";
import { decide, preCheck, sendCheck, type OtherClaim } from "@/lib/rule";
import type { ClaimSummary, Store } from "@/lib/store";
import type { CheckSpec, Claim, Decision, Money, Reason, Recall, Verdict } from "@/lib/types";

// The owner's claim, end to end. Every outside call comes in through PipelineDeps, so the tests run it without a
// network. Order (docs/PRODUCT.md): preCheck -> save photos and hashes -> model -> decide -> sendCheck on a fresh
// read -> payout -> persist. Whatever fails after the photos arrive, the claim ends up held with a reason: never lost.

export interface PipelineDeps {
  store: Store;
  vision(input: { images: Buffer[]; spec: CheckSpec; code: string }): Promise<{ verdict: Verdict; seconds: number; model: string }>;
  pay(input: { claimId: string; payoutKey: string; payerId: string; amount: Money; note: string }): Promise<PayoutStatus>;
  hash(jpeg: Buffer): Promise<string>;
  now(): Date;
  limits: Limits;
}

export class ClaimError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409,
    message: string,
  ) {
    super(message);
    this.name = "ClaimError";
  }
}

/** A new claim refused by one of the live demo's spending limits (src/lib/limits.ts). Nothing was saved. */
export class LimitReached extends Error {
  constructor(readonly refusal: Refusal) {
    super(`The ${refusal.kind} claim limit (${refusal.limit}) is reached`);
    this.name = "LimitReached";
  }
}

export interface Payer {
  payerId: string;
  verified: boolean;
}

export const MAX_PHOTOS = 3;
// A check that hasn't answered this long after the photos arrived is held for a person (see recoverStale).
export const STALE_AFTER_MS = 150_000;
export const LIMIT_HOLD = "Remedy's daily photo-check limit is reached; a person will review this claim";

const event = (at: Date, type: string, detail: string) => ({ at: at.toISOString(), type, detail });
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

const toOther = (r: ClaimSummary): OtherClaim => ({ id: r.id, recallId: r.recallId, payerId: r.payerId, decision: r.decision, photoHashes: r.photoHashes });

// Whether a row is a demo claim of this demo claim's round (src/lib/demo/round.ts): the browser's round id and the
// PayPal account, so a second login in one browser starts afresh. Claims filed before rounds existed have no round id:
// they make one legacy round per PayPal account, as they were checked then.
const inRound = (claim: Pick<Claim, "payerId" | "demoRound">, r: ClaimSummary) =>
  r.demo === true && r.payerId === claim.payerId && (claim.demoRound ? r.demoRound === claim.demoRound : !r.demoRound);

// Who a claim is checked against. Seeded claims never count. Real claims never meet demo claims, and a demo claim
// only meets its own round's, so every round sees the genuine sample pass once, however many judges share a login.
// The genuine sample meets only the round's other genuine claims: the other samples, waiting on the model or held,
// and a repost of its photo sent while it is checked, must not block or hold the one that should be paid.
// A run of the same sample that the model never answered (held with a "model" reason) doesn't count either, so the
// result's "Run again" gets the model's answer instead of a duplicate-photo block.
export function othersFor(claim: Pick<Claim, "demo" | "payerId" | "demoRound" | "events">, rows: ClaimSummary[]): OtherClaim[] {
  const sample = demoSampleOf(claim);
  const genuine = sample === "genuine";
  const unanswered = (r: ClaimSummary) => r.sample === sample && r.decision === "held" && r.reason?.check === "model";
  return checkableClaims(rows)
    .filter((r) => (claim.demo ? inRound(claim, r) && (!genuine || r.sample === "genuine") && !unanswered(r) : !r.demo))
    .map(toOther);
}

export interface DuplicateMatch {
  /** This claim's photo that was a repost (1-based). */
  photo: number;
  /** The earlier claim that has it, and which of its photos (1-based). */
  id: string;
  theirs: number;
  payerId: string;
  /** The earlier claim's demo sample, if it's a demo claim. */
  sample?: string;
}

/**
 * Where a refused repost's photo was claimed before, for the result's side by side: the oldest claim filed by the
 * time this one was, among those it was checked against (othersFor), that has a matching photo. null if none matches now.
 */
export function duplicateOf(claim: Pick<Claim, "id" | "demo" | "payerId" | "demoRound" | "events" | "photos" | "createdAt">, rows: ClaimSummary[]): DuplicateMatch | null {
  const checked = new Set(othersFor(claim, rows).map((o) => o.id));
  const earlier = rows.filter((r) => checked.has(r.id) && r.id !== claim.id && r.createdAt <= claim.createdAt).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const [i, { hash }] of claim.photos.entries()) {
    for (const r of earlier) {
      const j = r.photoHashes.findIndex((h) => isLikelySame(hash, h));
      if (j >= 0) return { photo: i + 1, id: r.id, theirs: j + 1, payerId: r.payerId, sample: r.sample };
    }
  }
  return null;
}

/**
 * duplicateOf for a claim the console's grid has only as an index row: the same rounds, the same match, so the queue's
 * line and the evidence panel (and the owner's result) always name the same earlier claim.
 */
export function duplicateOfRow(row: ClaimSummary, rows: ClaimSummary[]): DuplicateMatch | null {
  const events = row.sample ? [{ at: row.createdAt, type: "demo_sample", detail: row.sample }] : [];
  return duplicateOf({ ...row, photos: row.photoHashes.map((hash) => ({ key: "", hash })), events }, rows);
}

/** A round's demo claims on this recall for this PayPal account, newest first as the index keeps them. */
export const roundClaims = (rows: ClaimSummary[], recallId: string, round: string, payerId: string) =>
  rows.filter((r) => r.demo === true && r.recallId === recallId && r.demoRound === round && r.payerId === payerId);

/**
 * A start of this sample in the round that is still waiting for its photo, with at least half its camera session left:
 * "Run this sample" pressed again (after Back, or in a second tab) continues it instead of leaving another empty start.
 */
export function openStart(round: ClaimSummary[], sample: string, now: Date): ClaimSummary | null {
  const fresh = (r: ClaimSummary) => now.getTime() - Date.parse(r.createdAt) < (CAPTURE_SESSION_MINUTES * 60_000) / 2;
  return round.find((r) => r.sample === sample && r.decision === "pending" && r.photoHashes.length === 0 && fresh(r)) ?? null;
}

/** Why this sample can't be filed in the round yet, or null: the repost needs the round's genuine photo already sent. */
export function notYet(sample: DemoSample, round: ClaimSummary[]): string | null {
  if (!sample.after || round.some((r) => r.sample === sample.after && r.photoHashes.length > 0)) return null;
  return `Send "${demoSample(sample.after)?.title}" first: this one reposts its photo.`;
}

/** The demo sample a demo claim was filed with, from its events. */
export { demoSampleOf };

/** The note the owner reads on the payout in PayPal, whether the rule or a person sent it. */
export const payoutNote = (recall: Pick<Recall, "id" | "product">, claim: Pick<Claim, "id" | "demo">) =>
  `Recall refund for ${recall.product} (CPSC ${recall.id}), claim ${claim.id}`;

/**
 * A payout that failed, for the claim's history: whether Remedy couldn't reach PayPal (a network error, so nothing left)
 * or PayPal refused it, then the raw answer, which the console keeps behind a toggle for support (drawer.ts).
 */
export function payoutFailedDetail(e: unknown): string {
  if (e instanceof PayPalError) return `PayPal didn't take the payout: ${e.issue ?? e.status}${e.debugId ? `, debug id ${e.debugId}` : ""}`;
  return `Remedy couldn't reach PayPal: ${(e instanceof Error ? e.message : String(e)).slice(0, 200)}`;
}

/** The page for a claim: demo claims live under /try. */
export const claimPath = (slug: string, claim: Pick<Claim, "id" | "demo">) => `/r/${slug}/${claim.demo ? "try" : "claim"}/${claim.id}`;

const live = (r: ClaimSummary) => r.decision === "paid" || r.decision === "held" || (r.decision === "pending" && r.photoHashes.length > 0);

/**
 * The real claim this payer should continue: one already in progress or decided as paid or held, or an open one
 * whose camera session is still running. Null means start a new one. `rows`: index.json, when the caller has read it.
 */
export async function findOpenClaim(deps: Pick<PipelineDeps, "store" | "now">, recall: Recall, payerId: string, rows?: ClaimSummary[]): Promise<Claim | null> {
  const mine = (rows ?? (await deps.store.listClaims())).filter((r) => r.recallId === recall.id && r.payerId === payerId && !r.seeded && !r.demo);
  const decided = mine.find(live);
  if (decided) return deps.store.getClaim(decided.id);
  for (const row of mine.filter((r) => r.decision === "pending" && r.photoHashes.length === 0)) {
    const claim = await deps.store.getClaim(row.id);
    if (claim?.captureSession && new Date(claim.captureSession.expiresAt) > deps.now()) return claim;
  }
  return null;
}

/**
 * Issues the code and opens the 10-minute camera session. A demo claim takes its code from the sample and joins the
 * browser's round. Throws LimitReached, saving nothing, when a claim limit is hit. rows: index.json, when the caller has
 * just read it (the limits are counted on the index as it's written either way).
 */
export async function createClaim(
  deps: Pick<PipelineDeps, "store" | "now" | "limits">,
  { recall, payer, sample, round, rows: read }: { recall: Recall; payer: Payer; sample?: DemoSample; round?: string; rows?: ClaimSummary[] },
): Promise<Claim> {
  const now = deps.now();
  const rows = read ?? (await deps.store.listClaims());
  const visionUsed = sample ? (await deps.store.getUsage(utcDay(now))).vision : 0;
  const taken = new Set(rows.map((r) => r.id));
  const code = sample?.code ?? newCode();
  const claim: Claim = {
    id: newClaimId(taken),
    recallId: recall.id,
    payerId: payer.payerId,
    payerVerified: payer.verified,
    payoutKey: newPayoutKey(),
    code,
    captureSession: newCaptureSession(now),
    photos: [],
    verdict: null,
    decision: "pending",
    reasons: [],
    payout: null,
    events: [
      event(now, "created", `Logged in with PayPal (${payer.verified ? "verified" : "unverified"} account)`),
      event(now, "code_issued", `Code ${code} issued; camera session open for ${CAPTURE_SESSION_MINUTES} minutes`),
      ...(sample ? [event(now, "demo_sample", sample.id)] : []),
    ],
    createdAt: now.toISOString(),
    ...(sample ? { demo: true, ...(round ? { demoRound: round } : {}) } : {}),
  };
  // Counted on the index as it's written, not on the read above, so parallel starts can't all pass on one snapshot.
  const refusal = await deps.store.addClaim(claim, (fresh) => claimRefusal(fresh, { payerId: payer.payerId, demo: Boolean(sample), now, limits: deps.limits, visionUsed }));
  if (refusal) throw new LimitReached(refusal);
  return claim;
}

/**
 * The photos arrive: pre-checks, then the photos and their hashes are saved on the claim before any model call, so a
 * parallel claim with the same photo or account sees this one. Returns the claim, blocked or still pending.
 */
export async function receivePhotos(
  deps: Pick<PipelineDeps, "store" | "hash" | "now">,
  { claimId, payerId, sessionId, photos }: { claimId: string; payerId: string; sessionId: string; photos: Buffer[] },
): Promise<Claim> {
  const claim = await deps.store.getClaim(claimId);
  if (!claim || claim.payerId !== payerId) throw new ClaimError(404, "No such claim for this PayPal account");
  if (claim.decision !== "pending" || claim.photos.length) throw new ClaimError(409, "This claim's photos were already received");
  if (photos.length < 1 || photos.length > MAX_PHOTOS) throw new ClaimError(400, `Send 1 to ${MAX_PHOTOS} photos`);

  let hashes: string[];
  try {
    hashes = await Promise.all(photos.map((p) => deps.hash(p)));
  } catch {
    throw new ClaimError(400, "A photo couldn't be read as an image");
  }

  const now = deps.now();
  const rows = await deps.store.listClaims();
  let reasons = preCheck({ claim, sessionId, photoHashes: hashes, others: othersFor(claim, rows), now });
  // Demo samples other than the genuine one each show a different check; the one-claim rule would hide them all
  // behind "already claimed" once the round's genuine claim is paid.
  if (!oneClaimChecked(claim)) reasons = reasons.filter((r) => r.check !== "payer");

  // Kept for blocked claims too: the company sees what was sent, and a resend of the same photo is caught.
  const keys = photos.map((_, i) => `${claim.payoutKey}/${i + 1}.jpg`);
  for (let i = 0; i < photos.length; i++) await deps.store.putPhoto(keys[i], photos[i]);
  claim.photos = keys.map((key, i) => ({ key, hash: hashes[i] }));
  claim.events.push(event(now, "photos_received", claim.demo ? `${plural(photos.length, "photo")} from the demo` : `${plural(photos.length, "photo")} from the live camera`));

  if (reasons.length) {
    claim.decision = "blocked";
    claim.reasons = reasons;
    claim.events.push(event(now, "blocked", `Blocked before the photo check: ${reasons.map((r) => r.text).join("; ")}`));
  } else {
    claim.events.push(event(now, "prechecked", oneClaimChecked(claim) ? "Live session, new photos, no other paid or open claim from this account" : "Live session, new photos; one-claim check not run on this demo claim"));
  }
  await deps.store.putClaim(claim);
  return claim;
}

const decisionFor = (reasons: Reason[]): Decision => (reasons.some((r) => r.outcome === "reject") ? "rejected" : reasons.some((r) => r.outcome === "hold") ? "held" : "paid");

// Read, change and write, unless someone else decided the claim in the meantime (a person, or recoverStale).
async function commit(store: Store, id: string, change: (claim: Claim) => void): Promise<Claim | null> {
  const claim = await store.getClaim(id);
  if (!claim) return null;
  if (claim.decision !== "pending") return claim;
  change(claim);
  await store.putClaim(claim);
  return claim;
}

function hold(claim: Claim, now: Date, reasons: Reason[], detail: string) {
  claim.decision = "held";
  claim.reasons = reasons;
  claim.events.push(event(now, "decided", `Held for a person: ${detail}`));
}

/** The model, the rule and the payout. Safe to call twice: a claim that's decided or not ready is returned as is. */
export async function checkClaim(deps: PipelineDeps, claimId: string): Promise<Claim> {
  const { store } = deps;
  const start = await store.getClaim(claimId);
  if (!start) throw new ClaimError(404, "No such claim");
  if (start.decision !== "pending" || !start.photos.length || start.verdict) return start;

  // Fresh, past the recall cache: the refund and auto-pay decide what is paid.
  const recall = await store.getRecall(start.recallId, { fresh: true });
  if (!recall) {
    const reason: Reason = { check: "model", outcome: "hold", text: "The recall's check settings couldn't be loaded, so a person will look at your photos" };
    return (await commit(store, claimId, (c) => hold(c, deps.now(), [reason], reason.text))) ?? start;
  }

  // Counted once per claim, before the call: a claim already checked returned above. At the limit the claim is held,
  // never refused, since its photos are in. A store error here leaves it to recoverStale.
  if (!(await store.takeUsage(utcDay(deps.now()), "vision", deps.limits.vision))) {
    const reason: Reason = { check: "model", outcome: "hold", text: LIMIT_HOLD };
    return (await commit(store, claimId, (c) => hold(c, deps.now(), [reason], `the daily limit of ${plural(deps.limits.vision, "photo check")} is reached`))) ?? start;
  }

  let result: Awaited<ReturnType<PipelineDeps["vision"]>>;
  try {
    const images = await Promise.all(
      start.photos.map(async (p) => {
        const jpeg = await store.getPhoto(p.key);
        if (!jpeg) throw new Error(`photo ${p.key} is missing`);
        return jpeg;
      }),
    );
    result = await deps.vision({ images, spec: recall.spec, code: start.code });
  } catch (e) {
    const reason: Reason = { check: "model", outcome: "hold", text: "The photo check didn't answer, so a person will look at your photos instead" };
    const why = e instanceof Error ? e.message : String(e);
    return (await commit(store, claimId, (c) => hold(c, deps.now(), [reason], `photo check failed (${why.slice(0, 200)})`))) ?? start;
  }

  const { outcome, reasons } = decide(result.verdict, { spec: recall.spec, code: start.code, photos: start.photos.length });
  const checkedAt = deps.now();
  const autoPayOff: Reason[] = outcome === "pass" && !recall.autoPay ? [{ check: "auto_pay", outcome: "hold", text: "Auto-pay is off for this recall, so a person approves each refund" }] : [];

  // Save the model's answer first. Rejected and held claims end here.
  const saved = await commit(store, claimId, (c) => {
    c.verdict = result.verdict;
    c.reasons = [...reasons, ...autoPayOff];
    c.events.push(event(checkedAt, "checked", `Photo check answered in ${result.seconds.toFixed(1)} s (${result.model})`));
    if (outcome === "pass" && recall.autoPay) return;
    const first = c.reasons.find((r) => r.outcome === (outcome === "reject" ? "reject" : "hold"));
    c.decision = decisionFor(c.reasons);
    c.events.push(event(checkedAt, "decided", c.decision === "rejected" ? `Rejected: ${first?.text}` : `Held for a person: ${first?.text}`));
  });
  if (!saved || saved.decision !== "pending") return saved ?? start;

  // A fresh read of the claim and the index: a parallel claim may have got photos or been paid during the model call.
  const fresh = await store.getClaim(claimId);
  if (!fresh) return saved;
  const conflicts = sendCheck({ claim: fresh, others: othersFor(fresh, await store.listClaims()) });
  if (conflicts.some((r) => r.check === "state")) return fresh;
  if (conflicts.length) {
    return (await commit(store, claimId, (c) => hold(c, deps.now(), [...c.reasons, ...conflicts], conflicts.map((r) => r.text).join("; ")))) ?? fresh;
  }

  let payout: PayoutStatus;
  try {
    payout = await deps.pay({
      claimId: fresh.id,
      payoutKey: fresh.payoutKey,
      payerId: fresh.payerId,
      amount: recall.refund,
      note: payoutNote(recall, fresh),
    });
  } catch (e) {
    const reason: Reason = { check: "payout", outcome: "hold", text: "PayPal didn't accept the payout, so a person will send it" };
    return (
      (await commit(store, claimId, (c) => {
        c.events.push(event(deps.now(), "payout_failed", payoutFailedDetail(e)));
        hold(c, deps.now(), [...c.reasons, reason], reason.text);
      })) ?? fresh
    );
  }

  const paidAt = deps.now();
  return (
    (await commit(store, claimId, (c) => {
      c.decision = "paid";
      c.payout = { batchId: payout.batchId, ...(payout.itemId ? { itemId: payout.itemId } : {}), status: payout.itemStatus ?? payout.batchStatus, updatedAt: paidAt.toISOString(), amount: recall.refund };
      c.events.push(event(paidAt, "decided", "Every check passed"));
      c.events.push(event(paidAt, "payout_sent", `Payout of $${recall.refund.value} sent through PayPal`));
    })) ?? fresh
  );
}

/**
 * The model call runs after the photo upload has answered. If that work dies (a timeout, a crash), the claim would
 * wait forever: past STALE_AFTER_MS with no answer, hold it for a person instead.
 */
export async function recoverStale(deps: Pick<PipelineDeps, "store" | "now">, claim: Claim): Promise<Claim> {
  if (claim.decision !== "pending" || !claim.photos.length || claim.verdict) return claim;
  const received = claim.events.find((e) => e.type === "photos_received");
  if (!received || deps.now().getTime() - Date.parse(received.at) < STALE_AFTER_MS) return claim;
  const reason: Reason = { check: "model", outcome: "hold", text: "The photo check didn't finish, so a person will look at your photos instead" };
  return (await commit(deps.store, claim.id, (c) => hold(c, deps.now(), [reason], reason.text))) ?? claim;
}

/**
 * The owner asks a person to look at a claim the rule rejected on an uncertain read (src/lib/appeal.ts): it is held for
 * the company's review, once. The verdict, the rule's reasons and its "decided" event stay as recorded. A second ask
 * returns the claim as it is. Refused while another claim of this payer's for this recall is paid, held, checking or
 * has a code still open, since only one claim per account counts.
 */
export async function requestReview(deps: Pick<PipelineDeps, "store" | "now">, { claimId, payerId }: { claimId: string; payerId: string }): Promise<Claim> {
  const claim = await deps.store.getClaim(claimId);
  if (!claim || claim.payerId !== payerId) throw new ClaimError(404, "No such claim for this PayPal account");
  if (reviewAsked(claim)) return claim;
  if (!canAskForReview(claim)) throw new ClaimError(409, "This claim can't be sent for a review");

  const now = deps.now();
  const open = (r: ClaimSummary) => live(r) || (r.decision === "pending" && now.getTime() - Date.parse(r.createdAt) < CAPTURE_SESSION_MINUTES * 60_000);
  const other = (await deps.store.listClaims()).find((r) => r.id !== claim.id && r.recallId === claim.recallId && r.payerId === payerId && !r.demo && !r.seeded && open(r));
  if (other) throw new ClaimError(409, `Your claim ${other.id} for this recall is the one that counts now`);

  const saved = await deps.store.updateClaim(claim.id, (c) =>
    canAskForReview(c)
      ? { ...c, decision: "held", reasons: [...c.reasons, appealReason()], events: [...c.events, event(now, "review_requested", "The owner asked a person to look at the photos")] }
      : null,
  );
  return saved ?? (await deps.store.getClaim(claim.id)) ?? claim;
}
