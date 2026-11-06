import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { DEV_SESSION_SECRET, env } from "./env";

// Pure signing and parsing, no Next imports, so scripts and tests can mint and read sessions.
// The cookie side lives in session.ts.

export const Role = z.enum(["owner", "company"]);
export type Role = z.infer<typeof Role>;

export const Session = z.object({
  role: Role,
  payerId: z.string().min(1),
  verified: z.boolean(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  // Seconds since the epoch.
  iat: z.number().int(),
});
export type Session = z.infer<typeof Session>;

// An owner's session only has to last one claim; a company's lasts a working week.
export const SESSION_MAX_AGE: Record<Role, number> = { owner: 2 * 60 * 60, company: 7 * 24 * 60 * 60 };

// One cookie per role, so a company testing its own claim link doesn't sign itself out of the console.
export const SESSION_COOKIE: Record<Role, string> = { owner: "remedy_owner", company: "remedy_company" };

function secret(): string {
  const s = env().SESSION_SECRET;
  if (s === DEV_SESSION_SECRET && process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set in production");
  return s;
}

const mac = (body: string, key: string) => createHmac("sha256", key).update(body).digest("base64url");

// base64url(JSON).base64url(HMAC-SHA256). Signed, not encrypted: never put anything secret in it.
export function sign(value: unknown, key = secret()): string {
  const body = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${body}.${mac(body, key)}`;
}

// The JSON inside a token, or null if the signature is wrong or it doesn't parse.
export function unsign(token: string, key = secret()): unknown {
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const want = Buffer.from(mac(body, key));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function mintSession(s: Omit<Session, "iat">, { now = new Date(), key }: { now?: Date; key?: string } = {}): string {
  return sign(Session.parse({ ...s, iat: Math.floor(now.getTime() / 1000) }), key);
}

// A valid, unexpired session for this role, or null.
export function readSession(token: string | undefined, role: Role, { now = new Date(), key }: { now?: Date; key?: string } = {}): Session | null {
  if (!token) return null;
  const parsed = Session.safeParse(unsign(token, key));
  if (!parsed.success || parsed.data.role !== role) return null;
  const age = Math.floor(now.getTime() / 1000) - parsed.data.iat;
  return age >= 0 && age <= SESSION_MAX_AGE[role] ? parsed.data : null;
}

// Only same-site paths survive the login round trip, so ?next= can't send anyone to another site.
export function safeNext(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  try {
    const url = new URL(next, "http://x");
    return url.origin === "http://x" ? url.pathname + url.search + url.hash : fallback;
  } catch {
    return fallback;
  }
}

export const DEFAULT_NEXT: Record<Role, string> = { owner: "/", company: "/console" };
