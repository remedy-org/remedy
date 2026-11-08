"use server";

import { claimResult } from "./ClaimScreen";

/**
 * A decided claim's result, rendered on the server exactly as its page renders it: the checking screen asks for it as
 * soon as the decision is in and shows it in place when the last check lands, so the outcome draws once. Null while the
 * claim is still being checked, or when it isn't this owner's.
 */
export async function settleClaim(slug: string, id: string) {
  return claimResult(slug, id);
}
