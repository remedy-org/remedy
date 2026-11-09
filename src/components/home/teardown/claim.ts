// The facts the Opened Exhibit shows, and where each one comes from. Nothing here is invented.
//
// - Claim RM-0442 (src/lib/demo/claims.ts, GENUINE): the genuine claim (photo k01, code M4T) on the X-VESOLJE recall
//   (CPSC 27-071), filed 7 Nov 2026. Sent to PayPal 15 s after the photo, confirmed by PayPal at 55 s. The same facts as
//   src/components/home/custody/claim.ts and the console.
// - The photo (public/demo/k01-1.jpg) is generated (eval case k01-feathers-M4T: the recalled feather print, cut in half,
//   tagged). It carries no label (owner rule: no internal labels; the site's one sandbox line is in /terms).
// - The two quotes are GPT-6.1 Sol's own words on that photo, copied verbatim from the stored run
//   eval/out/runs/kikea-gpt-6.1-sol-r1.json (case k01-feathers-M4T, src/lib/demo/verdicts.json):
//   verdict.challenge_code.evidence and verdict.steps[0].evidence. Only the typography changed (straight quotes set as
//   curly ones).

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
  /** Photo received to PayPal confirming the payout, as the console's timeline has it. */
  confirmed: 55,
  /** Photo received to the three pre-checks done, and to the model's answer (the stored run's 11.29 s), when the rule
   * approves it: the console's Photo check and Decision. */
  prechecked: 0.3,
  answered: 11.29,
  photo: `/demo/${GENUINE.photos[0]}`,
  /** The photos of the recall's three claims before it (RM-9475, RM-2125, RM-0118 in claims.ts), for the fingerprint
   * check. */
  earlier: ["/demo/k11-1.jpg", "/demo/k04-1.jpg", "/demo/k02-1.jpg"],
  /**
   * The real 64-bit dHash of each photo (src/lib/fingerprint.ts, run on public/demo/*.jpg on 9 Nov 2026) and how many
   * bits the claim's photo differs from each earlier one. src/lib/rule.ts treats 8 or fewer as the same picture.
   */
  hash: "f14d8d1c8c89812c",
  earlierHashes: ["66fe30555d9891c1", "f1831369698b191e", "f6183159199941c0"],
  earlierDistance: [32, 27, 27],
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
    note: "Its fingerprint matches no photo on any earlier claim. A reposted copy would match, even resized, re-saved or brightened.",
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
    // Inside the exhibit’s own double quotes, so its inner quote is single (‘M4T’).
    quote: "The handwritten code reads ‘M4T’, matching the expected characters M, 4, T in order.",
  },
  {
    id: "torn",
    n: "05",
    label: CHECK_NAMES.destroyed("Pillow", true),
    ai: true,
    note: "The model looks for the cut.",
    quote: "Two fully separated pillow halves are visible, with open cut edges, exposed stuffing, and loose stuffing between them.",
  },
];

/**
 * The receipt's lines, all from the claim above: label, value, and whether the value is data (set in mono). The claim id
 * is the receipt's header, so it is not a row, and the five checks are the check row's under it, so they are not one
 * either. Sent, then PayPal's confirmation, the two steps the console's timeline gives the claim: the confirmation is
 * the last line, printed only when PayPal confirms (55 s), with the PAID stamp under it; until then its line is blank
 * paper, so the receipt never changes height.
 */
export const RECEIPT_ROWS: readonly [string, string, boolean][] = [
  ["Recall", EXHIBIT.recall, true],
  ["Code", EXHIBIT.code, true],
  ["Decision", "Approved by the rule", false],
  ["Paid to", "Verified PayPal account", false],
  // The times in the sans, as the console sets "15 s": in mono its space read as two.
  ["Sent to PayPal", `${EXHIBIT.seconds} s after the photo`, false],
  ["PayPal confirmed", `${EXHIBIT.confirmed} s after the photo`, false],
];
/** The row printed only once PayPal confirms the payout. */
export const CONFIRMED_ROW = RECEIPT_ROWS.length - 1;
