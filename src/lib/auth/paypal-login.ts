import { randomBytes } from "node:crypto";
import { z } from "zod";
import { env } from "../env";
import { DEFAULT_NEXT, Role, safeNext, sign, unsign } from "../session-token";

// The Log in with PayPal round trip: start sets a signed, short-lived state cookie; callback checks it.
// Kept free of Next imports so it is unit-tested directly; the route handlers are thin.

export const STATE_COOKIE = "remedy_oauth";
export const STATE_MAX_AGE = 10 * 60;
export const CALLBACK_PATH = "/api/auth/paypal/callback";

// Registered as the app's Return URL in the PayPal dashboard (docs/PRODUCT.md, Setup).
export const callbackUrl = () => new URL(CALLBACK_PATH, env().APP_URL).toString();

const LoginState = z.object({ state: z.string().min(16), as: Role, next: z.string(), iat: z.number().int() });
export type LoginState = z.infer<typeof LoginState>;

// Why a login came back without a session; the page at `next` (or /signin) shows the matching message.
export type AuthError = "denied" | "state" | "paypal";

export function beginLogin(params: URLSearchParams, now = new Date()): { state: LoginState; cookie: string } | { error: "role" } {
  const as = Role.safeParse(params.get("as"));
  if (!as.success) return { error: "role" };
  const state: LoginState = {
    state: randomBytes(24).toString("base64url"),
    as: as.data,
    next: safeNext(params.get("next"), DEFAULT_NEXT[as.data]),
    iat: Math.floor(now.getTime() / 1000),
  };
  return { state, cookie: sign(state) };
}

// The stored login if the cookie is ours, unexpired, and its state matches what PayPal echoed back.
export function checkState(cookie: string | undefined, returned: string | null, now = new Date()): LoginState | null {
  if (!cookie || !returned) return null;
  const parsed = LoginState.safeParse(unsign(cookie));
  if (!parsed.success) return null;
  const age = Math.floor(now.getTime() / 1000) - parsed.data.iat;
  if (age < 0 || age > STATE_MAX_AGE) return null;
  return parsed.data.state === returned ? parsed.data : null;
}

// Appends ?auth_error= to a same-site path.
export function withAuthError(path: string, error: AuthError): string {
  const url = new URL(path, "http://x");
  url.searchParams.set("auth_error", error);
  return url.pathname + url.search + url.hash;
}

// Where a failed login lands: the page that asked for it, or the company sign-in page.
export const errorPath = (login: LoginState | null, error: AuthError) =>
  withAuthError(login ? (login.as === "company" ? `/signin?next=${encodeURIComponent(login.next)}` : login.next) : "/signin", error);
