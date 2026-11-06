import { NextResponse, type NextRequest } from "next/server";
import { checkState, errorPath, STATE_COOKIE } from "@/lib/auth/paypal-login";
import { env } from "@/lib/env";
import { identify } from "@/lib/paypal/identity";
import { cookieOptions } from "@/lib/session";
import { mintSession, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session-token";

// GET /api/auth/paypal/callback?code=...&state=...  (or ?error=access_denied when the person cancels)
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const login = checkState(request.cookies.get(STATE_COOKIE)?.value, params.get("state"));
  const to = (path: string) => {
    const response = NextResponse.redirect(new URL(path, env().APP_URL));
    response.cookies.delete(STATE_COOKIE);
    return response;
  };

  if (!login) return to(errorPath(null, "state"));
  const code = params.get("code");
  if (params.get("error") || !code) return to(errorPath(login, "denied"));

  let user;
  try {
    user = await identify(code);
  } catch (e) {
    // The message names the failing call, never a token.
    console.error("PayPal login failed:", e instanceof Error ? e.message : e);
    return to(errorPath(login, "paypal"));
  }

  const response = to(login.next);
  const session = mintSession({ role: login.as, payerId: user.payerId, verified: user.verified, name: user.name, email: user.email });
  response.cookies.set(SESSION_COOKIE[login.as], session, cookieOptions(SESSION_MAX_AGE[login.as]));
  return response;
}
