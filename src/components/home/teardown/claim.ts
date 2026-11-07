// The facts the Opened Exhibit shows, and where each one comes from. Nothing here is invented for the illustration.
//
// - Claim RM-0442: filed through the judges' demo on 7 Nov 2026 with the "genuine" sample (src/lib/demo/samples.ts:
//   photo c02, code M4T) on the Kikea X-VESOLJE recall (CPSC 27-071). 15 s from the photo to the PayPal payout, in
//   sandbox money. The same facts as src/components/home/custody/claim.ts.
// - The photo (public/demo/c02-1.jpg) is AI-made test data (eval case c02-pillow-cut-lamplight), so the exhibit is
//   labelled as an illustration in every frame.
// - The two quotes are GPT-6.1 Sol's own words on that photo, copied verbatim from the stored run
//   eval/out/runs/spike2-gpt-6.1-sol-r1.json (case c02-pillow-cut-lamplight): verdict.challenge_code.evidence and the
//   first sentence of verdict.steps[0].evidence. Only the typography changed (straight quotes set as curly ones).

export const EXHIBIT = {
  id: "RM-0442",
  code: "M4T",
  label: "X-VESOLJE",
  amount: 29.99,
  recall: "CPSC 27-071",
  /** Photo received to payout sent. */
  seconds: 15,
  photo: "/demo/c02-1.jpg",
  /** Photos of earlier claims in the demo workspace (the console's seeded samples), for the fingerprint check. */
  earlier: ["/demo/c01-1.jpg", "/demo/c03-1.jpg", "/demo/c10-1.jpg"],
  /**
   * The real 64-bit dHash of each photo (src/lib/fingerprint.ts, run on public/demo/*.jpg on 7 Nov 2026) and how many
   * bits the claim's photo differs from each earlier one. src/lib/rule.ts treats 8 or fewer as the same picture.
   */
  hash: "100c8dc81e2979de",
  earlierHashes: ["e4a7694b37e6f6ff", "8f3f7c9e13c3e9f9", "b5752b27352fbbc1"],
  earlierDistance: [33, 33, 34],
  samePhotoBar: 8,
  honesty: "Illustration of claim RM-0442 · its photo is AI-made test data · sandbox money",
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
    label: "Live camera session",
    ai: false,
    note: "Taken in this claim’s 10-minute camera session, in the page’s own camera. There is no upload button.",
  },
  {
    id: "fp",
    n: "02",
    label: "Photo not seen before",
    ai: false,
    note: "Its 64-bit fingerprint differs from every earlier photo in the workspace by 33 or 34 bits. The same picture differs by 8 or fewer.",
  },
  {
    id: "acct",
    n: "03",
    label: "Verified PayPal account",
    ai: false,
    note: "PayPal reports the account as verified. One claim per account, per recall.",
  },
  {
    id: "code",
    n: "04",
    label: "Label and code M4T",
    ai: true,
    note: "The model reads the tag.",
    quote: "The handwritten code on the attached paper tag reads “M4T”, matching the expected code character by character.",
  },
  {
    id: "torn",
    n: "05",
    label: "Cut fully in half",
    ai: true,
    note: "The model looks for the cut.",
    quote: "Two separated pillow halves are visible, with exposed cut edges and stuffing spilling out.",
  },
];

/** The receipt's lines, all from the claim above. */
export const RECEIPT_ROWS: readonly [string, string][] = [
  ["Claim", EXHIBIT.id],
  ["Recall", EXHIBIT.recall],
  ["Code", EXHIBIT.code],
  ["Checks", "5 of 5 passed"],
  ["Decision", "Fixed rule: pay"],
  ["Sent", "Through PayPal"],
  ["Photo to payout", `${EXHIBIT.seconds} s`],
  ["Money", "Sandbox"],
];
