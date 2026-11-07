import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac } from "node:crypto";
import { z } from "zod";
import { DEV_SESSION_SECRET, env } from "@/lib/env";

// A thumbnail's ticket: which photo, for whom, until when, sealed (AES-256-GCM) so the store key inside never reaches
// the browser. The console mints one per photo when it renders a row it already showed this company, so the photo
// route can serve the thumbnail without opening the claim file: one Blob read per photo per width, ever (cached), and
// none per row.
//
// Deterministic (the IV is an HMAC of the payload, as in AES-SIV), so a row's URL stays the same across renders and
// polls for the day and the browser's cache keeps working. It reveals only that two tickets are equal.

const Ticket = z.object({ i: z.string(), n: z.number().int().min(0), k: z.string(), s: z.string(), e: z.number().int() });
export type PhotoTicket = { claimId: string; n: number; key: string; payerId: string };

const DAY = 86_400_000;

function keys() {
  const secret = env().SESSION_SECRET;
  if (secret === DEV_SESSION_SECRET && process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set in production");
  const derive = (use: string) => createHash("sha256").update(`remedy-photo-${use}:${secret}`).digest();
  return { enc: derive("enc"), mac: derive("mac") };
}

/** Good for the rest of today and tomorrow (UTC), so a URL minted at 23:59 still loads. */
export function sealPhoto(t: PhotoTicket, now = Date.now()): string {
  const { enc, mac } = keys();
  const body = Buffer.from(JSON.stringify({ i: t.claimId, n: t.n, k: t.key, s: t.payerId, e: Math.floor(now / DAY) + 2 }));
  const iv = createHmac("sha256", mac).update(body).digest().subarray(0, 12);
  const cipher = createCipheriv("aes-256-gcm", enc, iv);
  const sealed = Buffer.concat([cipher.update(body), cipher.final()]);
  return Buffer.concat([iv, sealed, cipher.getAuthTag()]).toString("base64url");
}

/** The ticket, if it's genuine, unexpired and for this company; otherwise null. */
export function openPhoto(token: string, payerId: string, now = Date.now()): PhotoTicket | null {
  try {
    const raw = Buffer.from(token, "base64url");
    if (raw.length < 12 + 16 + 2) return null;
    const decipher = createDecipheriv("aes-256-gcm", keys().enc, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(raw.length - 16));
    const body = Buffer.concat([decipher.update(raw.subarray(12, raw.length - 16)), decipher.final()]);
    const t = Ticket.parse(JSON.parse(body.toString("utf8")));
    if (t.s !== payerId || t.e <= Math.floor(now / DAY)) return null;
    return { claimId: t.i, n: t.n, key: t.k, payerId: t.s };
  } catch {
    return null;
  }
}

/** The photo route's URL for one photo with its ticket; the client adds &w= for the size it shows. */
export const sealedPhotoUrl = (claimId: string, n: number, key: string, payerId: string, now?: number) =>
  `/api/console/claims/${claimId}/photos/${n}?t=${sealPhoto({ claimId, n, key, payerId }, now)}`;
