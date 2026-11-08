// What a seeded sample claim's history says. The samples' photos are AI-made eval images and their payouts never
// leave, so the history must not say "live camera" or "sent through PayPal". The seed writes these, and the console's
// drawer rewrites older seeded claims to match.

export const samplePhotosDetail = (n: number) => `${n} sample ${n === 1 ? "photo" : "photos"} from the eval set`;
export const SAMPLE_PRECHECKED = "Sample claim: live session and first claim for this account assumed; photo fingerprint check not run";
export const samplePayoutDetail = (amount: string) => `Sample claim: the rule would pay ${amount}; nothing was sent`;
export const SAMPLE_PAYOUT_UPDATED = "Sample claim: no PayPal status, because nothing was sent";

// What the claim flow calls each of the four demo claims: its title, and one line of what happens to it. The same words
// in the picker, on the photo step and on a result's "Next claim".
export const SAMPLE_COPY: Record<string, { title: string; line: string }> = {
  genuine: { title: "Pillow cut in half, right code", line: "Pays $29.99 to your PayPal." },
  "wrong-code": { title: "Wrong code on the tag", line: "Remedy reads the tag and refuses it." },
  "ai-no-session": { title: "Photo uploaded from the gallery", line: "Stopped before any check runs." },
  reposted: { title: "The same photo, sent again", line: "Caught as a repeat of an earlier claim." },
};

export const sampleTitle = (id: string, fallback = "Claim") => SAMPLE_COPY[id]?.title ?? fallback;
