import { NextResponse, type NextRequest } from "next/server";
import { DEMO_ROUND_COOKIE, demoRoundCookie, newDemoRound, parseDemoRound } from "@/lib/demo/round";
import { SESSION_COOKIE } from "@/lib/session-token";

export function proxy(request: NextRequest) {
  return request.nextUrl.pathname.startsWith("/console") ? toSignin(request) : withDemoRound(request);
}

// Signed out, /console redirects before anything renders: a 307 to sign-in, never a 200 that streams the console's
// header and then refreshes. This only looks for the cookie; each page still checks its signature and expiry with
// requireSession.
function toSignin(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE.company)) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  const signin = new URL("/signin", request.url);
  signin.searchParams.set("next", pathname + search);
  return NextResponse.redirect(signin, 307);
}

// The samples page starts a demo round (src/lib/demo/round.ts) for a browser without one. A page can't set cookies,
// so it's set here, on the request too, so the page renders with it.
function withDemoRound(request: NextRequest) {
  if (parseDemoRound(request.cookies.get(DEMO_ROUND_COOKIE)?.value)) return NextResponse.next();
  const round = newDemoRound();
  request.cookies.set(DEMO_ROUND_COOKIE, round);
  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set(DEMO_ROUND_COOKIE, round, demoRoundCookie());
  return response;
}

export const config = {
  matcher: ["/console", "/console/:path*", "/r/:recall/try/samples"],
};
