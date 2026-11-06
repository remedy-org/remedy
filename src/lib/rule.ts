import { isLikelySame } from "./fingerprint";
import type { CheckSpec, Claim, Decision, Outcome, Reason, Verdict } from "./types";

type Texts = Record<Outcome, string>;
const TRI: Record<"yes" | "no" | "unclear", Outcome> = { yes: "pass", no: "reject", unclear: "hold" };
const STEP: Record<"done" | "not_done" | "unclear", Outcome> = { done: "pass", not_done: "reject", unclear: "hold" };

// The model describes; this rule decides. Any "no" rejects, any "unclear" holds for a person (spike 2's decide()).
// Every check also gets a sentence for the UI.
export function decide(v: Verdict, { spec, code, photos }: { spec: CheckSpec; code: string | null; photos: number }): { outcome: Outcome; reasons: Reason[] } {
  const reasons: Reason[] = [];
  const add = (check: string, outcome: Outcome, texts: Texts) => reasons.push({ check, outcome, text: texts[outcome] });

  const seen = v.label.text_seen ? ` (reads "${v.label.text_seen}")` : "";
  add("label", TRI[v.label.matches_recalled_product], spec.label_must_show.length
    ? { pass: `Label matches the recalled product${seen}`, reject: `Label doesn't match the recalled product${seen}`, hold: `Couldn't read the label clearly${seen}` }
    : { pass: "Looks like the recalled product", reject: "Doesn't look like the recalled product", hold: "Couldn't tell if this is the recalled product" });

  if (code) {
    const read = v.challenge_code.text_seen;
    // The photos are the claimant's and can carry text aimed at the model, so "matches" only passes if what it
    // read is the code: a "yes" with nothing read holds, a "yes" with other text rejects.
    const norm = (t: string) => t.replace(/\s/g, "").toUpperCase();
    let outcome = TRI[v.challenge_code.matches];
    if (outcome === "pass") outcome = read === null ? "hold" : norm(read) === norm(code) ? "pass" : "reject";
    add("code", outcome, {
      pass: `Written code reads ${read}, matching this claim's code`,
      reject: read ? `Written code reads ${read}; this claim's code is ${code}` : `No code written in the photos; this claim's code is ${code}`,
      hold: `Couldn't read the written code clearly; this claim's code is ${code}`,
    });
  }

  // "Same item" only means something with more than one photo.
  if (photos > 1) {
    const all = photos === 2 ? "both photos" : "all photos";
    add("same_item", TRI[v.same_item_in_all_photos], { pass: `The same item is in ${all}`, reject: "The photos show different items", hold: `Couldn't tell if ${all} show the same item` });
  }

  // Inverted: "yes, it's a photo of a screen" is the failing answer.
  const screen = { yes: "reject", no: "pass", unclear: "hold" } as const;
  add("screen", screen[v.looks_like_photo_of_screen_or_print], {
    pass: "A real photo, not of a screen or a print",
    reject: "Looks like a photo of a screen or a print",
    hold: "Couldn't rule out a photo of a screen or a print",
  });

  // Walk the spec's steps too, so a step the model skipped holds instead of silently passing.
  for (let i = 0; i < Math.max(spec.proof_steps.length, v.steps.length); i++) {
    const step = spec.proof_steps[i] ?? v.steps[i].step;
    add(`step_${i + 1}`, STEP[v.steps[i]?.status ?? "unclear"], { pass: `Done: ${step}`, reject: `Not done: ${step}`, hold: `Couldn't confirm: ${step}` });
  }

  const outcomes = reasons.map((r) => r.outcome);
  const outcome = outcomes.includes("reject") ? "reject" : outcomes.includes("hold") ? "hold" : "pass";
  return { outcome, reasons };
}

export interface OtherClaim {
  id: string;
  recallId: string;
  payerId: string;
  decision: Decision;
  photoHashes: string[];
}

type Candidate = Pick<Claim, "id" | "recallId" | "payerId" | "payerVerified" | "decision">;

// The checks preCheck and sendCheck share. Another claim by this payer for this recall blocks unless it was rejected
// or blocked; a pending one blocks once it has photos, since its model call may be running right now. So save a
// claim's photos to the store before its model call.
function conflicts(claim: Candidate, photoHashes: string[], others: OtherClaim[], add: (check: string, text: string) => void) {
  if (claim.decision !== "pending") add("state", `This claim is already ${claim.decision}`);
  if (!claim.payerVerified) add("payer_verified", "This PayPal account isn't verified; verify it with PayPal, then claim again");

  const rest = others.filter((o) => o.id !== claim.id);
  photoHashes.forEach((hash, i) => {
    if (rest.some((o) => o.photoHashes.some((h) => isLikelySame(hash, h)))) add("duplicate_photo", `Photo ${i + 1} was already used in another claim`);
  });

  const live = (o: OtherClaim) => o.decision === "paid" || o.decision === "held" || (o.decision === "pending" && o.photoHashes.length > 0);
  const prior = rest.find((o) => o.recallId === claim.recallId && o.payerId === claim.payerId && live(o));
  if (prior) add("payer", `This PayPal account already has a claim for this recall (${prior.id})`);
}

// Cheap checks before any photo reaches the model. Each failure is an immediate reject; empty means go ahead.
export function preCheck({
  claim,
  sessionId,
  photoHashes,
  others,
  now = new Date(),
}: {
  claim: Candidate & Pick<Claim, "captureSession">;
  // The session id the photos arrived with.
  sessionId: string;
  photoHashes: string[];
  // Every other stored claim, from the store's index.
  others: OtherClaim[];
  now?: Date;
}): Reason[] {
  const reasons: Reason[] = [];
  const reject = (check: string, text: string) => reasons.push({ check, outcome: "reject", text });

  const session = claim.captureSession;
  if (!session || session.id !== sessionId) reject("session", `${photoHashes.length === 1 ? "This photo wasn't" : "These photos weren't"} taken in this claim's camera session`);
  else if (now > new Date(session.expiresAt)) reject("session", "The camera session expired before the photos arrived; start a new one");

  conflicts(claim, photoHashes, others, reject);
  return reasons;
}

// Run right before sendPayout, on a fresh read of the claim and of the index: a parallel claim may have got photos
// or been paid during the model call. Empty means send. Otherwise don't send: hold for a person, since two claims
// that raced each other both land here. A "state" reason means the claim was already decided elsewhere; leave it.
export function sendCheck({ claim, others }: { claim: Candidate & Pick<Claim, "photos">; others: OtherClaim[] }): Reason[] {
  const reasons: Reason[] = [];
  conflicts(claim, claim.photos.map((p) => p.hash), others, (check, text) => reasons.push({ check, outcome: "hold", text }));
  return reasons;
}
