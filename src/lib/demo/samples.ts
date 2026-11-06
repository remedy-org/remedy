import type { Decision } from "../types";

// The judges' demo (/r/kikea-x-vesolje/try): four sample claims that run the real pipeline on our own AI-made photos.
// Photos are served from public/demo. Checked live against DEMO_SPEC on 7 Nov 2026 (GPT-6.1 Sol, high):
// genuine paid, wrong-code rejected on the code check.

export type DemoSampleId = "genuine" | "wrong-code" | "ai-no-session" | "reposted";

export interface DemoSample {
  id: DemoSampleId;
  /** Picker title. */
  title: string;
  /** One or two sentences: what it is and what should happen. */
  description: string;
  /** Public paths, in capture order. */
  photos: string[];
  /** The code this demo claim is issued, so the photo's hand-written code matches (or deliberately doesn't). null: issue a fresh one. */
  code: string | null;
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
    description: "The pillow cut in half, with the X-VESOLJE tag and this claim's code, M4T, written on it. Every check passes and the refund is paid.",
    photos: ["/demo/c02-1.jpg"],
    code: "M4T",
    liveSession: true,
    expect: "paid",
    decidedBy: "all",
    source: "c02-pillow-cut-lamplight",
  },
  {
    id: "wrong-code",
    title: "The wrong code",
    description: "A real-looking cut pillow, but the tag reads K7Q and this claim's code is K7P. The model reads the tag character by character, and the claim is rejected.",
    photos: ["/demo/c11-1.jpg"],
    code: "K7P",
    liveSession: true,
    expect: "rejected",
    decidedBy: "code",
    source: "c11-wrong-code-K7P",
  },
  {
    id: "ai-no-session",
    title: "An AI image, sent in",
    description: "An AI-made photo of the real Kikea pillow, cut, with a code tag. It never reaches the model: it wasn't taken in this claim's live camera session.",
    photos: ["/demo/c08-1.jpg"],
    code: "K7Q",
    liveSession: false,
    expect: "blocked",
    decidedBy: "session",
    source: "c08-kikea-cut",
  },
  {
    id: "reposted",
    title: "A reposted photo",
    description: "The genuine claim's photo, sent again from another PayPal account. It matches a photo already claimed, so it's refused before the model.",
    photos: ["/demo/c02-1.jpg"],
    code: null,
    liveSession: true,
    expect: "blocked",
    decidedBy: "duplicate_photo",
    after: "genuine",
    source: "c02-pillow-cut-lamplight",
  },
];

export const demoSample = (id: string) => DEMO_SAMPLES.find((s) => s.id === id) ?? null;
