// AG Studio runs only under a key that is set and not expired; otherwise Insights is Remedy's own (InsightsReport) and
// AG Studio's module never loads, so no visitor sees its licence notice or watermark. The key is a public build-time
// value (NEXT_PUBLIC_AG_STUDIO_LICENSE), but it is never logged.

const ZERO_WIDTH = /[​-‍﻿]/g;

function millis(segment: string): number | null {
  try {
    const text = atob(segment);
    return /^\d{10,}$/.test(text) ? Number(text) : null;
  } catch {
    return null;
  }
}

/**
 * When the key stops working, from its last "_"-separated segment (base64 epoch millis), as AG reads it: the key ends in
 * a 32-character hash, so the segment is read with that hash off, or whole. Null when neither reads as a date.
 */
export function studioExpiry(key: string): Date | null {
  const clean = key.replace(ZERO_WIDTH, "").replace(/\r?\n|\r/g, "");
  const body = clean.length > 32 ? clean.slice(0, -32) : clean;
  const segment = (s: string) => s.slice(s.lastIndexOf("_") + 1);
  const at = millis(segment(body)) ?? millis(segment(clean));
  return at === null ? null : new Date(at);
}

/** The AG Studio key, only when it is set and unexpired; a key whose expiry can't be read is trusted. */
export function studioLicence(now = Date.now(), key = process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE): string | null {
  const trimmed = key?.trim();
  if (!trimmed) return null;
  const expiry = studioExpiry(trimmed);
  return expiry && expiry.getTime() <= now ? null : trimmed;
}
