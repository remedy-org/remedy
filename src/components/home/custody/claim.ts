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

export const SANDBOX_ACCOUNTS_URL = "https://developer.paypal.com/tools/sandbox/accounts/";

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

// The five checks in the order "What stops a fake" lists them (src/lib/rule.ts: preCheck's three, then the model's).
// Quotes are GPT-6.1 Sol's own words on this photo (eval/out/runs/spike2-gpt-6.1-sol-r1.json, case c02), verbatim.
export const CHECKS: { label: string; ai: boolean; quote?: string; region?: RegionId }[] = [
  { label: "Live camera session", ai: false },
  { label: "Photo not seen before", ai: false },
  { label: "Verified PayPal account", ai: false },
  {
    label: "Label and code M4T",
    ai: true,
    quote: "The handwritten code on the attached paper tag reads “M4T”, matching the expected code character by character.",
    region: "code",
  },
  {
    label: "Cut fully in half",
    ai: true,
    quote: "Two separated pillow halves are visible, with exposed cut edges and stuffing spilling out.",
    region: "cut",
  },
];

// Where the model looked, as a share of the 4:3 crop (left, top, width, height), placed by eye on c02-1.jpg.
export type RegionId = "code" | "cut";
export const REGIONS: Record<RegionId, { x: number; y: number; w: number; h: number }> = {
  code: { x: 0.66, y: 0.6, w: 0.3, h: 0.24 },
  cut: { x: 0.18, y: 0.3, w: 0.42, h: 0.36 },
};

// The scroll thresholds (spec H2): when each check ticks, and when each code character appears.
// Tuned a little early against the spec's table so the AC frames (0.40, 0.70) land on finished states.
export const TICK_AT = [0.615, 0.63, 0.645, 0.665, 0.705];
export const CODE_AT = [0.35, 0.36, 0.37];
/** The tag is written left to right after the last character appears. */
export const WRITE_AT = [0.375, 0.397] as const;

// The console replica after the payout: the M4T claim slides in over the seeded sample claims the demo workspace starts
// with (src/lib/demo/seed.ts keeps their eval photos' codes; the reasons are rule.ts's words). Samples were never paid.
export const CONSOLE_ROWS: { photo: string; code: string; id?: string; status: Status; reason: string; time?: string; amount?: number; sample?: boolean }[] = [
  { photo: "/demo/c01-1.jpg", code: "K7Q", status: "paid", reason: "Every check passed", amount: 29.99, sample: true },
  { photo: "/demo/c03-1.jpg", code: "R9D", status: "held", reason: "Couldn't tell if both photos show the same item", sample: true },
  { photo: "/demo/c11-1.jpg", code: "K7P", status: "rejected", reason: "Written code reads K7Q; this claim's code is K7P", sample: true },
  { photo: "/demo/c08-1.jpg", code: "K7X", status: "blocked", reason: "This photo wasn't taken in this claim's camera session", sample: true },
];
