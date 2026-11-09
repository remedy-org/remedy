import type { Reason } from "./types";

// Every screen lists a claim's reasons in one order, whatever order they were recorded in, so the same photo reads the
// same way each time it is checked: the reason decide() acts on first (src/lib/rule.ts: any refusal rejects, else any
// hold holds), then the rest. The model's checks take one fixed order among themselves: the code, the label, the same
// item, the screen, then each step in the notice's order. The code leads because it is the steadiest answer: in the
// 9 Nov test (97 cases, 3 runs each) it never changed between runs, while the label, the screen or a step changed in 15
// cases, and with the label first 11 refusals led with a different reason from one run to the next (with the code
// first, only the 2 whose decision itself changed). Every other reason keeps the place it was recorded in: preCheck's
// checks already run in one order, and a conflict found later (sendCheck, a person's approve), auto-pay, the payout or
// a review is appended after what first decided the claim, which still leads. Display only: what is recorded, and every
// decision, stay as they are.
const MODEL_ORDER = ["code", "label", "same_item", "screen"];

// A model check's place in MODEL_ORDER (steps after it, by number); -1 for any other reason.
function rankOf(check: string): number {
  const i = MODEL_ORDER.indexOf(check);
  if (i >= 0) return i;
  const step = /^step_(\d+)$/.exec(check);
  return step ? MODEL_ORDER.length + Number(step[1]) : -1;
}

type Ranked = Pick<Reason, "check" | "outcome">;

/** The reasons with the model's checks in their fixed order, in the places the model's checks were recorded in; every
 * other reason stays where it was. */
export function byCheck<R extends Pick<Reason, "check">>(reasons: readonly R[]): R[] {
  const model = reasons
    .map((r, i) => [r, i] as const)
    .filter(([r]) => rankOf(r.check) >= 0)
    .sort(([a, i], [b, j]) => rankOf(a.check) - rankOf(b.check) || i - j)
    .map(([r]) => r);
  let next = 0;
  return reasons.map((r) => (rankOf(r.check) >= 0 ? model[next++] : r));
}

/** The reason decide() acts on: the first refusal in byCheck's order, else the first hold. Null when nothing failed. */
export function decidingCheck<R extends Ranked>(reasons: readonly R[]): R | null {
  const ordered = byCheck(reasons);
  return ordered.find((r) => r.outcome === "reject") ?? ordered.find((r) => r.outcome === "hold") ?? null;
}

/** A claim's reasons as every screen lists them: the deciding one first, then the rest as byCheck orders them. */
export function inDecidingOrder<R extends Ranked>(reasons: readonly R[]): R[] {
  const first = decidingCheck(reasons);
  const ordered = byCheck(reasons);
  return first ? [first, ...ordered.filter((r) => r !== first)] : ordered;
}
