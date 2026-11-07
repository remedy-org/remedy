// What a seeded sample claim's history says. The samples' photos are AI-made eval images and their payouts never
// leave, so the history must not say "live camera" or "sent through PayPal". The seed writes these, and the console's
// drawer rewrites older seeded claims to match.

export const samplePhotosDetail = (n: number) => `${n} sample ${n === 1 ? "photo" : "photos"} from the eval set`;
export const SAMPLE_PRECHECKED = "Sample claim: live session and first claim for this account assumed; photo fingerprint check not run";
export const samplePayoutDetail = (amount: string) => `Sample claim: the rule would pay ${amount}; nothing was sent`;
export const SAMPLE_PAYOUT_UPDATED = "Sample claim: no PayPal status, because nothing was sent";
