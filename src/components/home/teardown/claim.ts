// The facts the Opened Exhibit shows, and where each one comes from. Nothing here is invented.
//
// - Claim RM-0442 (src/lib/demo/claims.ts, GENUINE): the genuine claim (photo c02, code M4T) on the X-VESOLJE recall
//   (CPSC 27-071), filed 7 Nov 2026. 15 s from the photo to the PayPal payout. The same facts as
//   src/components/home/custody/claim.ts and the console.
// - The photo (public/demo/c02-1.jpg) is generated (benchmark case c02-pillow-cut-lamplight, docs/EVAL.md). It carries
//   no label (owner rule: no internal labels; the site's one sandbox line is in /terms).
// - The two quotes are GPT-6.1 Sol's own words on that photo, copied verbatim from the stored run
//   eval/out/runs/spike2-gpt-6.1-sol-r1.json (case c02-pillow-cut-lamplight): verdict.challenge_code.evidence and the
//   first sentence of verdict.steps[0].evidence. Only the typography changed (straight quotes set as curly ones).

import { GENUINE } from "@/lib/demo/claims";
import { CHECK_NAMES } from "@/lib/fiveChecks";

export const EXHIBIT = {
  id: GENUINE.id,
  code: GENUINE.code,
  label: "X-VESOLJE",
  amount: 29.99,
  recall: "CPSC 27-071",
  /** Photo received to payout sent. */
  seconds: GENUINE.toPayout!,
  photo: `/demo/${GENUINE.photos[0]}`,
  /** The photos of the recall's three claims before it (RM-9475, RM-2125, RM-0118 in claims.ts), for the fingerprint
   * check. */
  earlier: ["/demo/c09-1.jpg", "/demo/c05-1.jpg", "/demo/c11-1.jpg"],
  /**
   * The real 64-bit dHash of each photo (src/lib/fingerprint.ts, run on public/demo/*.jpg on 9 Nov 2026) and how many
   * bits the claim's photo differs from each earlier one. src/lib/rule.ts treats 8 or fewer as the same picture.
   */
  hash: "100c8dc81e2979de",
  earlierHashes: ["cec4cc8c8cf87102", "e0fe3a3030709051", "e4a7694b37e6f6ff"],
  earlierDistance: [26, 38, 33],
  samePhotoBar: 8,
} as const;

export type CheckId = "live" | "fp" | "acct" | "code" | "torn";

export interface Check {
  id: CheckId;
  n: string;
  label: string;
  /** The three pre-checks need no AI; the model reads the last two. */
  ai: boolean;
  /** What the check does, in Remedy's own words (src/lib/rule.ts, docs/PRODUCT.md). */
  note: string;
  /** The model's verbatim words, when the model is the one reading. */
  quote?: string;
}

export const CHECKS: readonly Check[] = [
  {
    id: "live",
    n: "01",
    label: CHECK_NAMES.session,
    ai: false,
    note: "Taken in this claim’s 10-minute camera session, in the page’s own camera. There is no upload button.",
  },
  {
    id: "fp",
    n: "02",
    label: CHECK_NAMES.duplicate,
    ai: false,
    note: "Its fingerprint matches no photo on any earlier claim. A reposted or lightly edited copy would match.",
  },
  {
    id: "acct",
    n: "03",
    label: CHECK_NAMES.account,
    ai: false,
    note: "PayPal reports the account as verified. One claim per account, per recall.",
  },
  {
    id: "code",
    n: "04",
    label: CHECK_NAMES.code("M4T", "X-VESOLJE"),
    ai: true,
    note: "The model reads the tag.",
    quote: "The handwritten code on the attached paper tag reads “M4T”, matching the expected code character by character.",
  },
  {
    id: "torn",
    n: "05",
    label: CHECK_NAMES.destroyed("Pillow", true),
    ai: true,
    note: "The model looks for the cut.",
    quote: "Two separated pillow halves are visible, with exposed cut edges and stuffing spilling out.",
  },
];

/**
 * The receipt's lines, all from the claim above: label, value, and whether the value is data (set in mono). The claim id
 * is the receipt's header, so it is not a row.
 */
export const RECEIPT_ROWS: readonly [string, string, boolean][] = [
  ["Recall", EXHIBIT.recall, true],
  ["Code", EXHIBIT.code, true],
  ["Checks", "All 5 passed", false],
  ["Decision", "Approved by the rule", false],
  // The time in the sans, as the console sets "15 s": in mono its space read as two.
  ["Photo to payout", `${EXHIBIT.seconds} s`, false],
  ["Paid to", "Verified PayPal account", false],
];
