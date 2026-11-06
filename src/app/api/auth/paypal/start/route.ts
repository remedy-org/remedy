import { NextResponse, type NextRequest } from "next/server";
import { beginLogin, callbackUrl, STATE_COOKIE, STATE_MAX_AGE } from "@/lib/auth/paypal-login";
import { env } from "@/lib/env";
import { loginUrl } from "@/lib/paypal/identity";
import { cookieOptions } from "@/lib/session";

// GET /api/auth/paypal/start?as=owner|company&next=/path
export async function GET(request: NextRequest) {
  const app = new URL(env().APP_URL);
  // PayPal returns to APP_URL, so the state cookie must be set on that host too (localhost vs 127.0.0.1).
  // The Host header, not nextUrl: the dev server reports localhost for both.
  if (request.headers.get("host") !== app.host) {
    return NextResponse.redirect(new URL(request.nextUrl.pathname + request.nextUrl.search, app));
  }

  const begun = beginLogin(request.nextUrl.searchParams);
  if ("error" in begun) return NextResponse.json({ error: "as must be owner or company" }, { status: 400 });

  const response = NextResponse.redirect(loginUrl({ redirectUri: callbackUrl(), state: begun.state.state }));
  response.cookies.set(STATE_COOKIE, begun.cookie, cookieOptions(STATE_MAX_AGE));
  return response;
}
