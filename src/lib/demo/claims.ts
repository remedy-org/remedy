// The demo recall's claims (X-VESOLJE, CPSC 27-071): the one dataset every picture of Remedy reads. The console builds its
// claims from it in memory at request time (dataset.ts, through seed.ts's builder; nothing is stored), and the homepage's hero line, How it works' console, the Opened Exhibit, the For
// companies tour, the sign-in page and the CPSC report all draw those same claims (claims.test.ts checks every replica
// against this list).
//
// - One photo set per claim (public/demo), each claim its own one-time code. The one deliberate duplicate is the repost,
//   which names the claim it copied. There are fewer claims than the old seed's 40 because there are only this many
//   distinct photos: a queue of the same three pillows reads as made up.
// - Every model answer is a stored one from the eval (verdicts.json, by case and run); the app's own rule decides.
// - Every photo shows the recalled pillow in one of its three prints, cut and tagged as the spec asks (DEMO_SPEC). Each
//   code is the claim's own and one Remedy can issue (src/lib/codes.ts); the wrong-code claim's tag reads K7Q, which it
//   never issues.
// - Paid is a claim PayPal paid: RM-0442, the genuine claim, 15 s from its photo to its PayPal payout. No claim sits
//   approved with nothing sent: every other one the model saw is held or rejected by its answer.
// - Times are written against DATASET_NOW (UTC). The dataset moves them forward by whole days to the request's day
//   (dataset.ts datasetShift), so the newest claim is always yesterday's and every time of day stays: the console, the
//   homepage and the report give every claim the same filing time.

export type DemoOutcome = "paid" | "approved" | "held" | "rejected" | "blocked";

export interface DemoClaim {
  id: string;
  outcome: DemoOutcome;
  /** File names in public/demo, in capture order. */
  photos: string[];
  /** The one-time code the claim was issued. A decided claim keeps the code hand-written in its photos. */
  code: string;
  /** When the owner logged in with PayPal, UTC. The code is issued 15 s later. */
  filed: string;
  /** Seconds from the code to the photos arriving. */
  shoot: number;
  /** The stored model answer it was checked with (verdicts.json: case and run). */
  answer?: { case: string; source: string };
  /** The pre-check that blocked it before the photo check. */
  block?: "session" | "duplicate" | "unverified";
  /** A repost: the claim whose photo it sent again. */
  copies?: string;
  /** Photos received to PayPal payout, in seconds: only a claim PayPal paid has one. */
  toPayout?: number;
}

// The app's model (gpt-6.1-sol, high) on each photo, against DEMO_SPEC (eval/specs/kikea-tagged.json): run 1 of three.
const RUN = (set: "kikea" | "kikea-held2") => `eval/out/runs/${set}-gpt-6.1-sol-r1.json`;

/** Newest first, as the console's queue opens. */
export const DEMO_CLAIMS: readonly DemoClaim[] = [
  // The genuine claim the homepage stages (DEMO_SAMPLES "genuine": the feather print, code M4T), paid 15 s after its photo.
  { id: "RM-0442", outcome: "paid", photos: ["k01-1.jpg"], code: "M4T", filed: "2026-11-07T15:08:12Z", shoot: 164, answer: { case: "k01-feathers-M4T", source: RUN("kikea") }, toPayout: 15 },
  { id: "RM-9475", outcome: "blocked", block: "unverified", photos: ["k11-1.jpg"], code: "J4R", filed: "2026-11-07T10:26:44Z", shoot: 211 },
  // The repost: RM-6276's photo, the same file, sent again from another account.
  { id: "RM-2125", outcome: "blocked", block: "duplicate", copies: "RM-6276", photos: ["k04-1.jpg"], code: "W3F", filed: "2026-11-06T22:51:27Z", shoot: 96 },
  // The tag reads K7Q: a near miss of this claim's K7P that was never issued to anyone (Remedy never issues a Q).
  { id: "RM-0118", outcome: "rejected", photos: ["k02-1.jpg"], code: "K7P", filed: "2026-11-06T17:39:02Z", shoot: 187, answer: { case: "k02-floral-K7Q", source: RUN("kikea") } },
  // Shot from standing height in a dim room: the tag's writing is too small to read, so a person looks.
  { id: "RM-9629", outcome: "held", photos: ["k10-1.jpg"], code: "H9D", filed: "2026-11-06T13:05:48Z", shoot: 243, answer: { case: "k10-puzzle-far-dim-H9D", source: RUN("kikea-held2") } },
  // Cut most of the way across, the halves still joined by a strip of fabric: not cut fully in half.
  { id: "RM-6276", outcome: "rejected", photos: ["k04-1.jpg"], code: "F3X", filed: "2026-11-06T08:17:31Z", shoot: 138, answer: { case: "k04-puzzle-joined-F3X", source: RUN("kikea") } },
  // A picture of the cut floral pillow from outside the claim's camera, with someone else's code (H6N) on its tag.
  { id: "RM-9545", outcome: "blocked", block: "session", photos: ["web-1.jpg"], code: "T7C", filed: "2026-11-05T19:42:10Z", shoot: 302 },
];

/** Where the paper tag sits in a held claim's photo, as a share of the photo's width and height: the console's Zoom to
 * tag opens the photo viewer there. RM-9629's photo, shot from standing height, is the one whose tag is too small to read
 * at a glance. */
export const TAG_SPOTS: Readonly<Record<string, { x: number; y: number }>> = { "k10-1.jpg": { x: 0.78, y: 0.54 } };

/** The claim the homepage stages start to finish. */
export const GENUINE = DEMO_CLAIMS.find((c) => c.id === "RM-0442")!;
