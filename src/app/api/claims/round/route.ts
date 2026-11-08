import type { NextRequest } from "next/server";
import { DEMO_ROUND_COOKIE, demoRoundCookie, newDemoRound } from "@/lib/demo";
import { RecallSlug } from "@/lib/types";
import { seeOther } from "../_lib/http";

// POST /api/claims/round (form: recall=<slug>): "Run the samples again". Starts a new demo round for this browser, so
// its samples are checked only against each other and reach the same four outcomes again. Earlier rounds' claims stay.
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const slug = RecallSlug.safeParse(String(form?.get("recall") ?? ""));
  // ?cleared: the picker tells a screen reader the four claims were cleared (the page itself just looks fresh).
  const response = seeOther(slug.success ? `/r/${slug.data}/try/samples?cleared=1` : "/");
  response.cookies.set(DEMO_ROUND_COOKIE, newDemoRound(), demoRoundCookie());
  return response;
}
