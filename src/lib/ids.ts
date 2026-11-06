import { randomBytes, randomInt, randomUUID } from "node:crypto";
import type { CaptureSession } from "./types";

// The code is issued inside the capture session, so the session is short: long enough to cut and photograph.
export const CAPTURE_SESSION_MINUTES = 10;

// Random rather than sequential: two requests can't race to the same next number, and ids don't leak volume.
export function newClaimId(taken: ReadonlySet<string>): string {
  for (let i = 0; i < 50; i++) {
    const id = `RM-${String(randomInt(10_000)).padStart(4, "0")}`;
    if (!taken.has(id)) return id;
  }
  throw new Error("No free claim id after 50 tries");
}

// Unique across every store and environment, unlike the claim id; see Claim.payoutKey.
export const newPayoutKey = (): string => randomUUID();

export function newCaptureSession(now = new Date()): CaptureSession {
  return {
    id: `cs_${randomBytes(16).toString("base64url")}`,
    expiresAt: new Date(now.getTime() + CAPTURE_SESSION_MINUTES * 60_000).toISOString(),
  };
}
