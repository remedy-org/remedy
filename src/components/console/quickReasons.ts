// One-click reasons for a reject, in the words the owner reads; the reviewer can edit them. Built per claim from its
// checks: the check that held or failed it comes first, and no reason a passed check contradicts is offered (a tag the
// photo check read as this claim's code is never "Wrong code"). Pure, so the panel and the bulk bar offer the same.

export interface QuickReason {
  label: string;
  // The owner's sentence, with this claim's code in it where it names one.
  text: (code: string) => string;
}

type Check = { id: string; state: string };

const SAME_ITEM: QuickReason = { label: "Not the same item", text: () => "The two photos don’t show the same product. Take both photos of one product in a new claim." };
const WRONG_CODE: QuickReason = { label: "Wrong code", text: (code) => `The tag in the photo doesn’t read ${code}, this claim’s code.` };
const NO_TAG: QuickReason = { label: "No tag", text: (code) => `The tag with the code ${code} isn’t in the photo.` };
const NOT_DESTROYED: QuickReason = { label: "Not destroyed", text: () => "The photos don’t show the product destroyed as the recall asks." };
const WRONG_PRODUCT: QuickReason = { label: "Wrong product", text: () => "The photos don’t show the recalled product." };
const NOT_REAL: QuickReason = { label: "Not a real photo", text: () => "The photo is of a screen or a print, not of the product itself." };

// The reason a check stands for when it held or failed the claim.
const FOR_CHECK = (id: string): QuickReason | null =>
  id === "same_item" ? SAME_ITEM : id === "code" ? WRONG_CODE : id === "label" ? NO_TAG : id === "screen" ? NOT_REAL : /^step_\d+$/.test(id) ? NOT_DESTROYED : null;

// The general reasons, each with the checks whose pass contradicts it.
const GENERAL: [QuickReason, (passed: (id: string) => boolean) => boolean][] = [
  [WRONG_CODE, (p) => p("code")],
  [NO_TAG, (p) => p("label") || p("code")],
  [NOT_DESTROYED, (p) => p("step_1")],
  [WRONG_PRODUCT, (p) => p("label")],
];

/** At most four: what held or failed the claim first, then the general reasons no passed check contradicts. */
export function quickReasons(checks: Check[]): QuickReason[] {
  const passed = (id: string) => checks.some((c) => c.id === id && c.state === "pass");
  const out: QuickReason[] = [];
  const add = (q: QuickReason | null) => q && !out.includes(q) && out.push(q);
  for (const c of checks) if (c.state === "hold" || c.state === "reject") add(FOR_CHECK(c.id));
  for (const [q, contradicted] of GENERAL) if (!contradicted(passed)) add(q);
  return out.slice(0, 4);
}

/** The reasons every one of several claims can be given: the bulk bar's. */
export function sharedQuickReasons(claims: Check[][]): QuickReason[] {
  if (!claims.length) return [];
  const [first, ...rest] = claims.map(quickReasons);
  return first.filter((q) => rest.every((r) => r.includes(q)));
}
