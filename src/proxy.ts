import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-token";

// Signed out, /console redirects before anything renders: a 307 to sign-in, never a 200 that streams the console's
// header and then refreshes. This only looks for the cookie; each page still checks its signature and expiry with
// requireSession.
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE.company)) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  const signin = new URL("/signin", request.url);
  signin.searchParams.set("next", pathname + search);
  return NextResponse.redirect(signin, 307);
}

export const config = {
  matcher: ["/console", "/console/:path*"],
};
