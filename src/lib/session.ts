import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_ROUND_COOKIE, parseDemoRound } from "./demo/round";
import { mintSession, readSession, SESSION_COOKIE, SESSION_MAX_AGE, type Role, type Session } from "./session-token";

export { DEFAULT_NEXT, Role, safeNext, Session, SESSION_COOKIE } from "./session-token";

export const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
});

// The signed-in owner or company, or null. Works in server components, route handlers and server functions.
export async function getSession(role: Role): Promise<Session | null> {
  return readSession((await cookies()).get(SESSION_COOKIE[role])?.value, role);
}

// This browser's demo round (src/lib/demo/round.ts), or null. The proxy starts one on the samples page.
export async function getDemoRound(): Promise<string | null> {
  return parseDemoRound((await cookies()).get(DEMO_ROUND_COOKIE)?.value);
}

// Where to send someone who needs to log in first: a company goes to /signin, an owner straight to PayPal.
export function loginPath(role: Role, next: string): string {
  const q = new URLSearchParams({ next });
  return role === "company" ? `/signin?${q}` : `/api/auth/paypal/start?as=owner&${q}`;
}

// For pages that need a session: redirects to log in, then back to `next`.
export async function requireSession(role: Role, next: string): Promise<Session> {
  const session = await getSession(role);
  if (!session) redirect(loginPath(role, next));
  return session;
}

// Route handlers and server functions only: cookies can't be set while a page renders.
export async function setSession(s: Omit<Session, "iat">): Promise<void> {
  (await cookies()).set(SESSION_COOKIE[s.role], mintSession(s), cookieOptions(SESSION_MAX_AGE[s.role]));
}

export async function clearSession(role?: Role): Promise<void> {
  const jar = await cookies();
  for (const r of role ? [role] : (["owner", "company"] as const)) jar.delete(SESSION_COOKIE[r]);
}
