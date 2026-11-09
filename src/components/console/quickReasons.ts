// One-click reasons for a reject, in the words the owner reads; the reviewer can edit them. Built per claim from its
// checks: the check that held or failed it comes first, and no reason a passed check contradicts is offered (a tag the
// photo check read as this claim's code is never "Wrong code"; a tag it saw but couldn't read is never "No tag" or
// "Wrong code"). Pure, so the panel and the bulk bar offer the same.

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
const UNREADABLE: QuickReason = { label: "Couldn’t read the code", text: (code) => `We couldn’t read the code ${code} on the tag. Write it larger and clearer, then claim again.` };
const NOT_REAL: QuickReason = { label: "Not a real photo", text: () => "The photo is of a screen or a print, not of the product itself." };

// The reason a check stands for when it held or failed the claim. A tag held is one the check saw but couldn't read, so
// a held tag check, and a held step whose answer turns on that tag, is "Couldn't read the code"; only a refused tag
// check is "No tag" or "Wrong code".
const FOR_CHECK = (c: Check, tagHeld: boolean): QuickReason | null => {
  if (c.id === "same_item") return SAME_ITEM;
  if (c.id === "screen") return NOT_REAL;
  if (c.id === "code" || c.id === "label") return c.state === "hold" ? UNREADABLE : c.id === "code" ? WRONG_CODE : NO_TAG;
  if (/^step_\d+$/.test(c.id)) return c.state === "hold" && tagHeld ? UNREADABLE : NOT_DESTROYED;
  return null;
};

// Each reason with the answers that contradict it: a passed check, or a tag seen but not read.
type Seen = { passed: (id: string) => boolean; tagHeld: boolean };
const CONTRADICTED = new Map<QuickReason, (s: Seen) => boolean>([
  [WRONG_CODE, (s) => s.passed("code") || s.tagHeld],
  [NO_TAG, (s) => s.passed("label") || s.passed("code") || s.tagHeld],
  [NOT_DESTROYED, (s) => s.passed("step_1")],
  [WRONG_PRODUCT, (s) => s.passed("label")],
  [UNREADABLE, (s) => s.passed("code")],
]);

// The general reasons, in the order they are offered.
const GENERAL = [WRONG_CODE, NO_TAG, NOT_DESTROYED, WRONG_PRODUCT];

/** At most four: what held or failed the claim first, then the general reasons; none a passed check contradicts. */
export function quickReasons(checks: Check[]): QuickReason[] {
  const seen: Seen = {
    passed: (id) => checks.some((c) => c.id === id && c.state === "pass"),
    tagHeld: checks.some((c) => (c.id === "label" || c.id === "code") && c.state === "hold"),
  };
  const out: QuickReason[] = [];
  const add = (q: QuickReason | null) => q && !out.includes(q) && !CONTRADICTED.get(q)?.(seen) && out.push(q);
  for (const c of checks) if (c.state === "hold" || c.state === "reject") add(FOR_CHECK(c, seen.tagHeld));
  for (const q of GENERAL) add(q);
  return out.slice(0, 4);
}

/** The reasons every one of several claims can be given: the bulk bar's. */
export function sharedQuickReasons(claims: Check[][]): QuickReason[] {
  if (!claims.length) return [];
  const [first, ...rest] = claims.map(quickReasons);
  return first.filter((q) => rest.every((r) => r.includes(q)));
}
