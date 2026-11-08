// What a seeded sample claim's history says. The samples' photos are AI-made eval images and their payouts never
// leave, so the history must not say "live camera" or "sent through PayPal". The seed writes these, and the console's
// drawer rewrites older seeded claims to match.

export const samplePhotosDetail = (n: number) => `${n} ${n === 1 ? "photo" : "photos"}`;
export const SAMPLE_PRECHECKED = "Session, account and photo fingerprint checks not run on this claim";
export const samplePayoutDetail = (amount: string) => `The rule approved ${amount}. No payout sent`;
export const SAMPLE_PAYOUT_UPDATED = "No PayPal status: no payout was sent";

// What the claim flow calls each of the four demo claims: an owner's situation, and one line of what is in the photo
// (never the outcome: the checks say that). The same words in the picker, on the photo step and on a result's "Next
// claim".
export const SAMPLE_COPY: Record<string, { title: string; line: string }> = {
  genuine: { title: "A genuine claim", line: "The pillow cut in half, its tag written with this claim's code." },
  "wrong-code": { title: "Wrong code on the tag", line: "A real cut pillow, but the tag carries a code this claim was never given." },
  "ai-no-session": { title: "Photo pulled from the web", line: "A picture of a cut pillow that was never taken in this claim's camera." },
  reposted: { title: "A photo used before", line: "The genuine claim's photo, sent again as a new claim." },
};

export const sampleTitle = (id: string, fallback = "Claim") => SAMPLE_COPY[id]?.title ?? fallback;
