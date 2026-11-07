import { newCode } from "@/lib/codes";
import { checkableClaims } from "@/lib/demo";
import type { DemoSample } from "@/lib/demo";
import { CAPTURE_SESSION_MINUTES, newCaptureSession, newClaimId, newPayoutKey } from "@/lib/ids";
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

export interface Payer {
  payerId: string;
  verified: boolean;
}

export const MAX_PHOTOS = 3;
// A check that hasn't answered this long after the photos arrived is held for a person (see recoverStale).
export const STALE_AFTER_MS = 150_000;

const event = (at: Date, type: string, detail: string) => ({ at: at.toISOString(), type, detail });
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

const toOther = (r: ClaimSummary): OtherClaim => ({ id: r.id, recallId: r.recallId, payerId: r.payerId, decision: r.decision, photoHashes: r.photoHashes });

// Who a claim is checked against. Seeded claims never count. Real claims never meet demo claims, and a demo claim
// only meets the same judge's demo claims, so each judge sees the genuine sample pass once.
export function othersFor(claim: Pick<Claim, "demo" | "payerId">, rows: ClaimSummary[]): OtherClaim[] {
  return checkableClaims(rows)
    .filter((r) => (claim.demo ? r.demo === true && r.payerId === claim.payerId : !r.demo))
    .map(toOther);
}

/** The demo sample a demo claim was filed with, from its events. */
export const demoSampleOf = (claim: Pick<Claim, "demo" | "events">) => (claim.demo ? (claim.events.find((e) => e.type === "demo_sample")?.detail ?? null) : null);

/** The note the owner reads on the payout in PayPal, whether the rule or a person sent it. */
export const payoutNote = (recall: Pick<Recall, "id" | "product">, claim: Pick<Claim, "id" | "demo">) =>
  `Recall refund for ${recall.product} (CPSC ${recall.id}), claim ${claim.id}${claim.demo ? ", demo mode" : ""}`;

/** The page for a claim: demo claims live under /try. */
export const claimPath = (slug: string, claim: Pick<Claim, "id" | "demo">) => `/r/${slug}/${claim.demo ? "try" : "claim"}/${claim.id}`;

const live = (r: ClaimSummary) => r.decision === "paid" || r.decision === "held" || (r.decision === "pending" && r.photoHashes.length > 0);

/**
 * The real claim this payer should continue: one already in progress or decided as paid or held, or an open one
 * whose camera session is still running. Null means start a new one.
 */
export async function findOpenClaim(deps: Pick<PipelineDeps, "store" | "now">, recall: Recall, payerId: string): Promise<Claim | null> {
  const mine = (await deps.store.listClaims()).filter((r) => r.recallId === recall.id && r.payerId === payerId && !r.seeded && !r.demo);
  const decided = mine.find(live);
  if (decided) return deps.store.getClaim(decided.id);
  for (const row of mine.filter((r) => r.decision === "pending" && r.photoHashes.length === 0)) {
    const claim = await deps.store.getClaim(row.id);
    if (claim?.captureSession && new Date(claim.captureSession.expiresAt) > deps.now()) return claim;
  }
  return null;
}

/** Issues the code and opens the 10-minute camera session. A demo claim takes its code from the sample. */
export async function createClaim(deps: Pick<PipelineDeps, "store" | "now">, { recall, payer, sample }: { recall: Recall; payer: Payer; sample?: DemoSample }): Promise<Claim> {
  const now = deps.now();
  const taken = new Set((await deps.store.listClaims()).map((r) => r.id));
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
    ...(sample ? { demo: true } : {}),
  };
  await deps.store.putClaim(claim);
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
  // behind "already claimed" once the judge's genuine claim is paid.
  if (claim.demo && demoSampleOf(claim) !== "genuine") reasons = reasons.filter((r) => r.check !== "payer");

  // Kept for blocked claims too: the company sees what was sent, and a resend of the same photo is caught.
  const keys = photos.map((_, i) => `${claim.payoutKey}/${i + 1}.jpg`);
  for (let i = 0; i < photos.length; i++) await deps.store.putPhoto(keys[i], photos[i]);
  claim.photos = keys.map((key, i) => ({ key, hash: hashes[i] }));
  claim.events.push(event(now, "photos_received", claim.demo ? `${plural(photos.length, "sample photo")} (demo mode)` : `${plural(photos.length, "photo")} from the live camera`));

  if (reasons.length) {
    claim.decision = "blocked";
    claim.reasons = reasons;
    claim.events.push(event(now, "blocked", `Blocked before the photo check: ${reasons.map((r) => r.text).join("; ")}`));
  } else {
    claim.events.push(event(now, "prechecked", "Live session, new photos, first claim for this account"));
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

  const recall = await store.getRecall(start.recallId);
  if (!recall) {
    const reason: Reason = { check: "model", outcome: "hold", text: "The recall's check settings couldn't be loaded, so a person will look at your photos" };
    return (await commit(store, claimId, (c) => hold(c, deps.now(), [reason], reason.text))) ?? start;
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
    const why = e instanceof PayPalError ? `${e.issue ?? e.status}${e.debugId ? `, debug id ${e.debugId}` : ""}` : e instanceof Error ? e.message.slice(0, 200) : String(e);
    return (
      (await commit(store, claimId, (c) => {
        c.events.push(event(deps.now(), "payout_failed", `PayPal refused the payout: ${why}`));
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
