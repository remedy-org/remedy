import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { Role, safeNext, SESSION_COOKIE } from "@/lib/session-token";

// POST /api/auth/signout, from a <form method="post">. Optional fields: as=owner|company (default both), next=/path.
// 303 so the browser follows with a GET.
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const role = Role.safeParse(form?.get("as") ?? request.nextUrl.searchParams.get("as"));
  const next = safeNext(String(form?.get("next") ?? request.nextUrl.searchParams.get("next") ?? ""), "/");

  const response = NextResponse.redirect(new URL(next, env().APP_URL), 303);
  for (const r of role.success ? [role.data] : (["owner", "company"] as const)) response.cookies.delete(SESSION_COOKIE[r]);
  return response;
}
