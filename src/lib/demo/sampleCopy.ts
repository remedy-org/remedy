// What a seeded sample claim's history says. The samples' photos are AI-made eval images and their payouts never
// leave, so the history must not say "live camera" or "sent through PayPal". The seed writes these, and the console's
// drawer rewrites older seeded claims to match.

export const samplePhotosDetail = (n: number) => `${n} ${n === 1 ? "photo" : "photos"}`;
export const SAMPLE_PRECHECKED = "Session, account and photo fingerprint checks not run on this claim";
export const samplePayoutDetail = (amount: string) => `The rule approved ${amount}. No payout sent`;
export const SAMPLE_PAYOUT_UPDATED = "No PayPal status: no payout was sent";

// What the claim flow calls each of the four demo claims: its title, and one line of what happens to it. The same words
// in the picker, on the photo step and on a result's "Next claim".
export const SAMPLE_COPY: Record<string, { title: string; line: string }> = {
  genuine: { title: "Right code on the tag", line: "Pays $29.99 to your PayPal." },
  "wrong-code": { title: "Wrong code on the tag", line: "Remedy reads the tag and refuses it." },
  "ai-no-session": { title: "A photo from the camera roll", line: "Refused before the photo check." },
  reposted: { title: "A photo already claimed", line: "Caught as a repeat of an earlier claim." },
};

export const sampleTitle = (id: string, fallback = "Claim") => SAMPLE_COPY[id]?.title ?? fallback;
