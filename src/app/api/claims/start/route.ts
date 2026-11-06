import type { NextRequest } from "next/server";
import { getRecallBySlug } from "@/lib/store";
import { getSession } from "@/lib/session";
import { liveDeps } from "../_lib/deps";
import { fail, seeOther, toLogin } from "../_lib/http";
import { claimPath, createClaim, findOpenClaim } from "../_lib/pipeline";

// GET /api/claims/start?recall=<slug>: where Log in with PayPal returns an owner. Continues their open claim for this
// recall (or shows the one already paid or held), else issues a new code. Find-or-create, so a reload is harmless.
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("recall") ?? "";
  const here = request.nextUrl.pathname + request.nextUrl.search;
  try {
    const deps = await liveDeps();
    const recall = await getRecallBySlug(slug, deps.store);
    if (!recall) return seeOther("/r/not-found");

    const session = await getSession("owner");
    if (!session) return toLogin(here);
    // An unverified account would be blocked after the photos; say so before the owner cuts anything.
    if (!session.verified) return seeOther(`/r/${recall.slug}?account=unverified`);

    const claim = (await findOpenClaim(deps, recall, session.payerId)) ?? (await createClaim(deps, { recall, payer: session }));
    return seeOther(claimPath(recall.slug, claim));
  } catch (e) {
    return fail(e);
  }
}
