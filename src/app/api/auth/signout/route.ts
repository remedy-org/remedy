import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { Role, safeNext, SESSION_COOKIE } from "@/lib/session-token";

// POST /api/auth/signout, from a <form method="post">. Optional fields: as=owner|company (default both), next=/path.
// 303 so the browser follows with a GET. Back on the sign-in page, ?signedout=1 has it say so.
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const role = Role.safeParse(form?.get("as") ?? request.nextUrl.searchParams.get("as"));
  const next = safeNext(String(form?.get("next") ?? request.nextUrl.searchParams.get("next") ?? ""), "/");

  const to = new URL(next, env().APP_URL);
  if (to.pathname === "/signin") to.searchParams.set("signedout", "1");
  const response = NextResponse.redirect(to, 303);
  for (const r of role.success ? [role.data] : (["owner", "company"] as const)) response.cookies.delete(SESSION_COOKIE[r]);
  return response;
}
