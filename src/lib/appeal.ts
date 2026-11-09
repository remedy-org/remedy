import type { Claim, Reason } from "./types";

// The owner's appeal: on a claim the rule rejected while the model wasn't sure of what it read, the owner can ask a
// person at the company to look, once. The rule's decision stands as recorded (verdict, reasons and the "decided"
// event are kept); the claim moves to held with one more reason, so it joins the company's review queue.

export const APPEAL_CHECK = "appeal";
export const APPEAL_TEXT = "Owner asked for a review";
export const appealReason = (): Reason => ({ check: APPEAL_CHECK, outcome: "hold", text: APPEAL_TEXT });

type Appealable = Pick<Claim, "decision" | "reasons" | "verdict" | "demo" | "seeded">;

/** Whether the owner already asked for a review of this claim. */
export const reviewAsked = (c: Pick<Claim, "reasons">) => c.reasons.some((r) => r.check === APPEAL_CHECK);

// The checks decide() makes from the model's answers. A reject from any other check is a hard rule or a person.
const MODEL_CHECK = /^(?:label|code|same_item|screen|step_\d+)$/;

// The model's own hedges when it isn't sure of what it read ("appears to read K7O", "could also be 0").
const HEDGE =
  /\b(?:appears? to|seems? to|could (?:also )?be|may be|might|possibly|perhaps|probably|likely|unclear|uncertain|unsure|not (?:entirely |fully |completely )?(?:sure|certain|clear|legible)|(?:hard|difficult) to (?:read|tell|make out)|can(?:no|'|’)t (?:be )?(?:read|tell|made out|make out)|illegible|ambiguous|faint|blurr?(?:y|ed)|partly|partially)\b/i;

function evidenceOf(check: string, v: NonNullable<Claim["verdict"]>): string {
  if (check === "label") return v.label.evidence;
  if (check === "code") return v.challenge_code.evidence;
  const step = /^step_(\d+)$/.exec(check);
  return step ? (v.steps[Number(step[1]) - 1]?.evidence ?? "") : "";
}

/**
 * A rejection that rests on an uncertain read: every reject is one of the model's checks (never a pre-check or a
 * person), and the model couldn't read the label or the code clearly, contradicted itself on the code (said it
 * matches but read other text), hedged in its own words on a check that rejected, or refused only because the photo
 * looked like one of a screen or a print (a real pillow in dim light can read as one; a person can tell).
 */
export function uncertainRead(c: Pick<Claim, "decision" | "reasons" | "verdict">): boolean {
  const v = c.verdict;
  if (c.decision !== "rejected" || !v) return false;
  const rejects = c.reasons.filter((r) => r.outcome === "reject");
  if (!rejects.length || rejects.some((r) => !MODEL_CHECK.test(r.check))) return false;
  const unclearRead = c.reasons.some((r) => (r.check === "label" || r.check === "code") && r.outcome === "hold");
  const contradicted = rejects.some((r) => r.check === "code") && v.challenge_code.matches === "yes";
  const hedged = rejects.some((r) => HEDGE.test(evidenceOf(r.check, v)));
  const screenOnly = rejects.every((r) => r.check === "screen");
  return unclearRead || contradicted || hedged || screenOnly;
}

/**
 * Whether the owner may ask a person to look: an uncertain-read rejection, asked at most once. Never on the judges'
 * demo samples (their outcomes are the eval's, and none is refused on an uncertain read) or seeded claims.
 */
export const canAskForReview = (c: Appealable) => !c.demo && !c.seeded && !reviewAsked(c) && uncertainRead(c);
