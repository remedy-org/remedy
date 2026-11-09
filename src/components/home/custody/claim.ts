import type { Verdict } from "@/components/console/VerdictMark";
import { GENUINE } from "@/lib/demo/claims";

// The one claim the homepage stages, start to finish: RM-0442 (src/lib/demo/claims.ts, GENUINE), the genuine claim (photo
// c02, code M4T) on the X-VESOLJE recall (CPSC 27-071), 15 s from photos received to the PayPal payout. Its photo is
// generated (benchmark case c02-pillow-cut-lamplight, docs/EVAL.md), and it carries no label (owner rule: no internal
// labels; the site's one sandbox line is in /terms). These are presentational copies of the claim screens: nothing here
// imports src/components/claim/*.
export const CLAIM = {
  id: GENUINE.id,
  code: GENUINE.code,
  amount: 29.99,
  /** Photos received to payout sent, claim RM-0442 (7 Nov 2026). */
  seconds: GENUINE.toPayout!,
  /** When it was filed, as the console lists it (UTC). */
  filed: "7 Nov 15:08",
  photo: `/demo/${GENUINE.photos[0]}`,
  /** The photo is 2:3 portrait; the camera frame is 4:3, cropped here (as the claim flow's camera does). */
  objectPosition: "50% 75%",
  recall: "CPSC 27-071",
  product: "X-VESOLJE Nursing Pillows",
  company: "Kikea Store",
  units: "About 19,596",
  recalled: "5 Nov 2026",
  /** CPSC's own product photo, as the recall page shows it (hot-linked from cpsc.gov, so it stays the official one). */
  cpscPhoto: "https://www.cpsc.gov/s3fs-public/Kikea1.png?VersionId=fn.ALOuj6jGY0PDI69W9G92X7BBbt49Q",
} as const;

/** The chapter rail, the static captions and the screen-reader list: the claim's five chapters, then the console. */
export const CHAPTERS = [
  {
    n: "01",
    title: "Log in with PayPal",
    text: "The owner opens the recall’s claim link and logs in with PayPal. Remedy sees the PayPal account ID, whether it’s verified, and the photos; never the password, balance or cards.",
  },
  {
    n: "02",
    title: "One-time code",
    text: "Remedy issues a three-character code, M4T. The owner writes X-VESOLJE M4T on a tag. The camera session lasts 10 minutes.",
  },
  {
    n: "03",
    title: "Live photo",
    text: "The owner photographs the pillow, cut in half with the tag on it, in the page’s live camera. There is no upload button.",
  },
  {
    n: "04",
    title: "Five checks",
    // The five checks by their names (lib/fiveChecks.ts), set in a sentence.
    text: "Three checks need no AI: taken in Remedy’s camera, photo not used before, one claim per PayPal account. Then the model checks the tag shows X-VESOLJE and M4T and the pillow is cut in half, quoting what it sees.",
  },
  {
    n: "05",
    title: "Paid",
    text: "Every check passed, so the rule paid $29.99 to the owner’s PayPal account, 15 seconds after the photo.",
  },
  {
    n: "06",
    title: "The recall team sees it",
    text: "The paid claim lands in the recall team’s console with its photo, its five checks and how fast they answered.",
  },
] as const;

// The scroll thresholds (spec H2), spread across each chapter's beat (01 is 0.2 to 0.34, 02 is 0.34 to 0.48 in
// pace.ts) so no stretch of a hold is still. (Chapters 03 to 05, with the five checks and their quotes, are the Opened
// Exhibit's: src/components/home/teardown/claim.ts.)
/** 01: the consent steps light in turn once the chapter has settled (0.2, the dolly done), CONSENT_STAGGER seconds apart,
 * in time rather than over a stretch of scroll, so the stop right after the dolly (0.215, where the #how anchor lands
 * too) finds them all lit and a fling never drifts on to reach them. */
export const CONSENT_AT = [0.2, 0.2, 0.2];
export const CONSENT_STAGGER = 0.3;
/** 02: the code appears in its boxes and on the tag as one event, in time once p passes CODE_AT: its characters drop in
 * CODE_STAGGER seconds apart, and the tag is written left to right over WRITE_FOR seconds as the last one lands, so no
 * stop ever rests on empty boxes beside a blank tag, or on two pictures of the code that disagree. */
export const CODE_AT = 0.352;
export const CODE_STAGGER = 0.1;
export const WRITE_FOR = 0.3;
/** Then what the photo must show lights in turn, leading into 03. */
export const SHOT_AT = [0.432, 0.444, 0.456];

// The console replica after the payout: RM-0442 slides in over the recall's other claims, exactly the rows the homepage's
// console tour and the console list (src/lib/demo/claims.ts, built by the seed), newest first: the same ids, photos,
// verdicts, reasons, filing times, photo-check times and amounts, so a claim reads the same in every picture
// (claims.test.ts checks it). Paid only where PayPal paid; Approved is a claim the rule passed with nothing sent.
// `fails`: which of the five checks (0 to 4) stopped a rejected or blocked claim. `filed`: day and time, UTC.
export const CONSOLE_ROWS: { photo: string; filed: string; id: string; status: Verdict; reason: string; time?: string; amount?: number; fails?: number }[] = [
  { photo: "/demo/c09-1.jpg", filed: "7 Nov 10:26", id: "RM-9475", status: "blocked", reason: "PayPal account not verified", fails: 2 },
  { photo: "/demo/c05-1.jpg", filed: "6 Nov 22:51", id: "RM-2125", status: "blocked", reason: "Photo already used in another claim · RM-6276", fails: 1 },
  { photo: "/demo/c11-1.jpg", filed: "6 Nov 17:39", id: "RM-0118", status: "rejected", reason: "Tag reads K7Q · code is K7P", time: "10 s", fails: 3 },
  { photo: "/demo/c03-1.jpg", filed: "6 Nov 13:05", id: "RM-9629", status: "held", reason: "Couldn’t tell if both photos show the same item", time: "12 s", amount: 29.99 },
  { photo: "/demo/c05-1.jpg", filed: "6 Nov 08:17", id: "RM-6276", status: "approved", reason: "All checks passed", time: "11 s", amount: 29.99 },
  { photo: "/demo/web-1.jpg", filed: "5 Nov 19:42", id: "RM-9545", status: "blocked", reason: "Photos outside the live camera session", fails: 0 },
];
