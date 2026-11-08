// What a seeded sample claim's history says. The samples' photos are AI-made eval images and their payouts never
// leave, so the history must not say "live camera" or "sent through PayPal". The seed writes these, and the console's
// drawer rewrites older seeded claims to match.

export const samplePhotosDetail = (n: number) => `${n} ${n === 1 ? "photo" : "photos"}`;
export const SAMPLE_PRECHECKED = "Starter claim: live session and first claim for this account assumed; photo fingerprint check not run";
export const samplePayoutDetail = (amount: string) => `Starter claim: the rule approved ${amount}; starter claims don't pay out`;
export const SAMPLE_PAYOUT_UPDATED = "Starter claim: no PayPal status, because starter claims don't pay out";
