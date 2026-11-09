// The demo recall's claims (X-VESOLJE, CPSC 27-071): the one dataset every picture of Remedy reads. The console builds its
// claims from it in memory at request time (dataset.ts, through seed.ts's builder; nothing is stored), and the homepage's hero line, How it works' console, the Opened Exhibit, the For
// companies tour, the sign-in page and the CPSC report all draw those same claims (claims.test.ts checks every replica
// against this list).
//
// - One photo set per claim (public/demo), each claim its own one-time code. The one deliberate duplicate is the repost,
//   which names the claim it copied. There are fewer claims than the old seed's 40 because there are only this many
//   distinct photos: a queue of the same three pillows reads as made up.
// - Every model answer is a stored one from the eval (verdicts.json, by case and run); the app's own rule decides.
// - Paid is a claim PayPal paid: RM-0442, the genuine claim, 15 s from its photo to its PayPal payout. Approved is a
//   claim the rule passed with nothing sent yet.
// - Times are fixed (UTC), so the console, the homepage and the report give every claim the same filing time.

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

const SOL = (n: 1 | 2 | 3) => `eval/out/runs/spike2-gpt-6.1-sol-r${n}.json`;
const TERRA = (n: 1 | 2 | 3) => `eval/out/runs/spike2-gpt-6.1-terra-r${n}.json`;

/** Newest first, as the console's queue opens. */
export const DEMO_CLAIMS: readonly DemoClaim[] = [
  // The genuine claim the homepage stages (DEMO_SAMPLES "genuine": photo c02, code M4T), paid 15 s after its photo.
  { id: "RM-0442", outcome: "paid", photos: ["c02-1.jpg"], code: "M4T", filed: "2026-11-07T15:08:12Z", shoot: 164, answer: { case: "c02-pillow-cut-lamplight", source: SOL(1) }, toPayout: 15 },
  { id: "RM-9475", outcome: "blocked", block: "unverified", photos: ["c09-1.jpg"], code: "J4R", filed: "2026-11-07T10:26:44Z", shoot: 211 },
  // The repost: RM-6276's photo, sent again from another account.
  { id: "RM-2125", outcome: "blocked", block: "duplicate", copies: "RM-6276", photos: ["c05-1.jpg"], code: "W3F", filed: "2026-11-06T22:51:27Z", shoot: 96 },
  { id: "RM-0118", outcome: "rejected", photos: ["c11-1.jpg"], code: "K7P", filed: "2026-11-06T17:39:02Z", shoot: 187, answer: { case: "c11-wrong-code-K7P", source: SOL(1) } },
  { id: "RM-9629", outcome: "held", photos: ["c03-1.jpg", "c03-2.jpg"], code: "R8D", filed: "2026-11-06T13:05:48Z", shoot: 243, answer: { case: "c03-pillow-two-photos", source: TERRA(3) } },
  { id: "RM-6276", outcome: "approved", photos: ["c05-1.jpg"], code: "K7Q", filed: "2026-11-06T08:17:31Z", shoot: 138, answer: { case: "c05-pillow-code-scrawled", source: SOL(1) } },
  // A picture of a cut pillow from outside the claim's camera, with someone else's code (H6N) on its tag.
  { id: "RM-9545", outcome: "blocked", block: "session", photos: ["web-1.jpg"], code: "T7C", filed: "2026-11-05T19:42:10Z", shoot: 302 },
];

/** The claim the homepage stages start to finish. */
export const GENUINE = DEMO_CLAIMS.find((c) => c.id === "RM-0442")!;
