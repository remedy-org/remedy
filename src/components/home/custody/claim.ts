import type { Status } from "@/components/ui";

// The one claim the homepage stages, start to finish: RM-0442, filed through the judges' demo on 7 Nov 2026 with the
// "genuine" sample (src/lib/demo/samples.ts: photo c02, code M4T) on the Kikea X-VESOLJE recall (CPSC 27-071). It took
// 15 s from photos received to the PayPal payout. Its photo is AI-made (eval case c02-pillow-cut-lamplight), so every
// place it shows carries an AI-MADE TEST PHOTO label. These are presentational copies of the claim screens: nothing
// here imports src/components/claim/*.
export const CLAIM = {
  id: "RM-0442",
  code: "M4T",
  amount: 29.99,
  /** Photos received to payout sent, claim RM-0442 (7 Nov 2026). */
  seconds: 15,
  photo: "/demo/c02-1.jpg",
  /** The photo is 2:3 portrait; the camera frame is 4:3, cropped here (as the claim flow's camera does). */
  objectPosition: "50% 75%",
  recall: "CPSC 27-071",
  product: "X-VESOLJE Nursing Pillows",
  company: "Kikea Store",
  units: "About 19,596",
  recalled: "5 Nov 2026",
} as const;

/** The chapter rail, the static captions and the screen-reader list. */
export const CHAPTERS = [
  {
    n: "01",
    title: "Log in with PayPal",
    text: "The owner opens Kikea Store's claim link and logs in with PayPal. Remedy sees the PayPal account ID, whether it's verified, and the photos; never the password, balance or cards.",
  },
  {
    n: "02",
    title: "One-time code",
    text: "Remedy issues a three-character code, M4T. The owner writes X-VESOLJE M4T on a tag. The camera session lasts 10 minutes.",
  },
  {
    n: "03",
    title: "Live photo",
    text: "The owner photographs the pillow, cut in half with the tag on it, in the page's live camera. There is no upload button.",
  },
  {
    n: "04",
    title: "Five checks",
    text: "Three checks need no AI: a live camera session, a photo never seen before, a verified PayPal account. Then the model reads the label and the code M4T and confirms the cut, quoting what it sees.",
  },
  {
    n: "05",
    title: "Paid",
    text: "A fixed rule decides: any failed check rejects, any unclear one holds for a person. Every check passed, so $29.99 went to the owner's PayPal account 15 seconds after the photo, and Kikea Store sees the claim in its console.",
  },
] as const;

// The scroll thresholds (spec H2), spread across each chapter's beat (01 is 0.2 to 0.34, 02 is 0.34 to 0.48 in
// pace.ts) so no stretch of a hold is still. (Chapters 03 to 05, with the five checks and their quotes, are the Opened
// Exhibit's: src/components/home/teardown/claim.ts.)
/** 01: each consent step lights in turn, the first as the chapter settles (the #how anchor is at 0.215). */
export const CONSENT_AT = [0.2, 0.255, 0.31];
/** 02: when each code character appears. */
export const CODE_AT = [0.352, 0.372, 0.392];
/** The tag is written left to right after the last character appears. */
export const WRITE_AT = [0.398, 0.436] as const;
/** Then what the photo must show lights in turn, leading into 03. */
export const SHOT_AT = [0.432, 0.444, 0.456];

// The console replica after the payout: the M4T claim slides in over sample claims the demo workspace starts with, with
// the ids, codes, photos and reasons buildSeedClaims gives them (src/lib/demo/seed.ts, seed 27071), as in the "For
// companies" replica (ConsoleReplica.tsx). Seeded claims are eval samples and were never paid.
export const CONSOLE_ROWS: { photo: string; code: string; id: string; status: Status; reason: string; time?: string; amount?: number; sample?: boolean }[] = [
  { photo: "/demo/c01-1.jpg", code: "K7Q", id: "RM-7581", status: "paid", reason: "Every check passed", amount: 29.99, sample: true },
  { photo: "/demo/c03-1.jpg", code: "R8D", id: "RM-9629", status: "held", reason: "Couldn't tell if both photos show the same item", sample: true },
  { photo: "/demo/c10-1.jpg", code: "K7Q", id: "RM-9545", status: "rejected", reason: "Looks like a photo of a screen or a print", sample: true },
  { photo: "/demo/c01-1.jpg", code: "R8D", id: "RM-0120", status: "blocked", reason: "Photo 1 was already used in another claim", sample: true },
];
