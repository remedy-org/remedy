import type { Claim, Decision } from "../types";

// The judges' demo (/r/kikea-x-vesolje/try): four sample claims that run the real pipeline on our own AI-made photos of
// the recalled pillow. Photos are served from public/demo. Checked three times each against DEMO_SPEC on 9 Nov 2026
// (gpt-6.1-sol, high; eval/out/runs/kikea-gpt-6.1-sol-r1..3.json): genuine passed 3/3, wrong-code rejected on the code
// check alone 3/3. The other two never reach the model.

export type DemoSampleId = "genuine" | "wrong-code" | "ai-no-session" | "reposted";

export interface DemoSample {
  id: DemoSampleId;
  /** Picker title. */
  title: string;
  /** One or two sentences: what it is and what should happen, as intent (the result shows what did). */
  description: string;
  /** Public paths, in capture order. */
  photos: string[];
  /** The code this demo claim is issued, so the photo's hand-written code matches (or deliberately doesn't). null: issue a fresh one. */
  code: string | null;
  /** The code hand-written on the photo's tag: this claim's code, or deliberately another one. */
  tagReads: string;
  /** false: the photos arrive without this claim's camera session (preCheck's "session" check refuses them). */
  liveSession: boolean;
  /** The decision the pipeline should reach. */
  expect: Decision;
  /** The check that decides it: a rule.ts reason check ("code", "session", "duplicate_photo") or "all" for a pass. */
  decidedBy: string;
  /** Run this sample first: the repost needs the genuine photo already claimed. */
  after?: DemoSampleId;
  /** The eval case the photo comes from (eval/photos). */
  source: string;
}

export const DEMO_SAMPLES: DemoSample[] = [
  {
    id: "genuine",
    title: "A genuine claim",
    description: "The feather-print pillow cut in half, with the X-VESOLJE tag and this claim’s code, M4T, on it. Every check passes, so Remedy pays it.",
    photos: ["/demo/k01-1.jpg"],
    code: "M4T",
    tagReads: "M4T",
    liveSession: true,
    expect: "paid",
    decidedBy: "all",
    source: "k01-feathers-M4T",
  },
  {
    id: "wrong-code",
    title: "The wrong code",
    description: "The floral pillow, really cut in half, but the tag reads K7Q and this claim’s code is K7P. The model reads the tag character by character, and the rule rejects it.",
    photos: ["/demo/k02-1.jpg"],
    code: "K7P",
    tagReads: "K7Q",
    liveSession: true,
    expect: "rejected",
    decidedBy: "code",
    source: "k02-floral-K7Q",
  },
  {
    id: "ai-no-session",
    title: "An uploaded photo",
    description: "A photo of the cut Kikea pillow, made outside this claim’s camera session, with someone else’s code on the tag. Remedy blocks it before the model sees it.",
    // c08's photo with its tag repainted to H6N (a code outside the issued alphabet, as K7Q is), so the two fakes never
    // carry the same code. The model never sees it: the camera check stops it first.
    photos: ["/demo/web-1.jpg"],
    code: null,
    tagReads: "H6N",
    liveSession: false,
    expect: "blocked",
    decidedBy: "session",
    source: "c08-kikea-cut",
  },
  {
    id: "reposted",
    title: "A reposted photo",
    description: "The genuine claim’s photo, sent again as a new claim. It matches a photo already claimed, so Remedy blocks it before the model.",
    photos: ["/demo/k01-1.jpg"],
    code: null,
    tagReads: "M4T",
    liveSession: true,
    expect: "blocked",
    decidedBy: "duplicate_photo",
    after: "genuine",
    source: "k01-feathers-M4T",
  },
];

export const demoSample = (id: string) => DEMO_SAMPLES.find((s) => s.id === id) ?? null;

/** The sample a demo claim ran, from its history; null for a real claim. */
export const demoSampleOf = (claim: Pick<Claim, "demo" | "events">) => (claim.demo ? (claim.events.find((e) => e.type === "demo_sample")?.detail ?? null) : null);

/**
 * Whether a claim met the one-claim-per-account check. Real claims always do; in the demo only the genuine sample does,
 * checked within its round (pipeline.ts), so each other sample can show its own check.
 */
export const oneClaimChecked = (claim: Pick<Claim, "demo" | "events">) => !claim.demo || demoSampleOf(claim) === "genuine";
