// What a seeded sample claim's history says. The samples' photos are AI-made eval images and their payouts never
// leave, so the history must not say "live camera" or "sent through PayPal". The seed writes these, and the console's
// drawer rewrites older seeded claims to match.

export const samplePhotosDetail = (n: number) => `${n} ${n === 1 ? "photo" : "photos"}`;
export const SAMPLE_PRECHECKED = "Session, account and photo fingerprint checks not run on this claim";
export const samplePayoutDetail = (amount: string) => `The rule approved ${amount}. No payout sent`;
export const SAMPLE_PAYOUT_UPDATED = "No PayPal status: no payout was sent";
