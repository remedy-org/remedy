import { APPEAL_CHECK, reviewAsked } from "@/lib/appeal";
import type { Claim, Outcome, Recall } from "@/lib/types";
import { isSandboxBuild } from "@/lib/demo/allowed";
import { SAMPLE_PRECHECKED, samplePayoutDetail, samplePhotosDetail } from "@/lib/demo/sampleCopy";
import { amountOf, checkLabel, companyReasonText, decisionSentence, formatMoney, maskPayer, preChecksOf, type PreCheckRow } from "./view";

// Everything the evidence drawer shows for one claim, built on the server so the client never sees a full payer id.

export interface DrawerCheck {
  id: string;
  // What was checked: "Label", "Step 1".
  label: string;
  outcome: Outcome;
  // The rule's sentence for this check.
  rule: string;
  // The model's quoted evidence, verbatim.
  evidence: string | null;
}

export interface DrawerClaim {
  id: string;
  createdAt: string;
  decision: Claim["decision"];
  payer: string;
  verified: boolean;
  code: string;
  seeded: boolean;
  demo: boolean;
  photos: string[];
  preChecks: PreCheckRow[];
  checks: DrawerCheck[];
  // The model's own one-line summary, when it answered.
  summary: string | null;
  sentence: string;
  amount: string;
  payout: { batchId: string; status: string; updatedAt: string } | null;
  events: Claim["events"];
  // The owner asked a person to look at a claim the rule refused (src/lib/appeal.ts): when, or null.
  appealedAt: string | null;
  // Approve and reject for held claims. A seeded one's review is a sample: answered, but never paid or saved.
  review: { sample: boolean; note: string | null } | null;
  recall: { id: string; autoPay: boolean };
  // Payouts in this build go to PayPal's sandbox: the approve step says so beside the amount.
  sandbox: boolean;
}

// What approve and reject answer: the claim, and for a seeded claim what the review would have done.
export type ReviewedClaim = DrawerClaim & { sample?: string };

// Pre-check reasons, a person's review, the owner's ask for one, auto-pay and the PayPal payout aren't model answers:
// the drawer shows them elsewhere (the pre-checks, what decided it, and the decision sentence).
const NOT_MODEL = new Set(["session", "duplicate_photo", "payer", "payer_verified", "state", "review", APPEAL_CHECK, "auto_pay", "payout"]);


function evidenceFor(check: string, outcome: Outcome, verdict: Claim["verdict"]): string | null {
  if (!verdict) return null;
  if (check === "label") return verdict.label.evidence || null;
  if (check === "code") return verdict.challenge_code.evidence || null;
  // The verdict has no quote of its own for these two answers: when one held or failed the claim, the model's summary
  // is its reasoning.
  if ((check === "same_item" || check === "screen") && outcome !== "pass") return verdict.summary || null;
  const step = check.match(/^step_(\d+)$/);
  return step ? (verdict.steps[Number(step[1]) - 1]?.evidence ?? null) : null;
}

export function photoUrl(claimId: string, n: number) {
  return `/api/console/claims/${claimId}/photos/${n}`;
}

/**
 * A seeded sample's history in the words of a sample: claims seeded before the wording changed still say "live camera"
 * and "sent through PayPal", which never happened. Their made-up PayPal status is left out.
 */
function sampleEvents(c: Claim, amount: string): Claim["events"] {
  return c.events
    .filter((e) => e.type !== "payout_updated")
    .map((e) =>
      e.type === "photos_received"
        ? { ...e, detail: samplePhotosDetail(c.photos.length) }
        : e.type === "prechecked"
          ? { ...e, detail: SAMPLE_PRECHECKED }
          : e.type === "payout_sent"
            ? { ...e, detail: samplePayoutDetail(amount) }
            : e,
    );
}

export function toDrawerClaim(c: Claim, recall: Recall): DrawerClaim {
  const amount = formatMoney(amountOf(c.payout?.amount, recall));
  const checks = c.reasons
    .filter((r) => !NOT_MODEL.has(r.check))
    .map((r) => ({ id: r.check, label: checkLabel(r.check, c.code), outcome: r.outcome, rule: companyReasonText(r, c.decision), evidence: evidenceFor(r.check, r.outcome, c.verdict) }));
  return {
    id: c.id,
    createdAt: c.createdAt,
    decision: c.decision,
    payer: maskPayer(c.payerId),
    verified: c.payerVerified,
    code: c.code,
    seeded: Boolean(c.seeded),
    demo: Boolean(c.demo),
    photos: c.photos.map((_, i) => photoUrl(c.id, i)),
    preChecks: preChecksOf(c),
    checks,
    summary: c.verdict?.summary ?? null,
    sentence: decisionSentence(c, recall),
    appealedAt: reviewAsked(c) ? (c.events.find((e) => e.type === "review_requested")?.at ?? c.createdAt) : null,
    amount,
    // A seeded sample's PayPal batch and status are made up by the seed: nothing was sent, so there is none to show.
    payout: c.payout && !c.seeded ? { batchId: c.payout.batchId, status: c.payout.status, updatedAt: c.payout.updatedAt } : null,
    events: c.seeded ? sampleEvents(c, amount) : c.events,
    review:
      c.decision === "held"
        ? c.seeded
          ? { sample: true, note: "Seeded sample, in every company's console, with a made-up PayPal account. Approve or reject shows what each does; no money moves and nothing is saved." }
          : { sample: false, note: null }
        : null,
    recall: { id: recall.id, autoPay: recall.autoPay },
    sandbox: isSandboxBuild(),
  };
}
