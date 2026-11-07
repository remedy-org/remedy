import type { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { liveDeps } from "../../_lib/deps";
import { fail, json, seeOther } from "../../_lib/http";
import { claimPath, requestReview } from "../../_lib/pipeline";

// POST /api/claims/<id>/review (a form on the refused result): the owner asks a person at the company to look at a claim
// the rule rejected on an uncertain read. Lands back on the claim, now held, which says what happens next.
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/claims/[id]/review">) {
  const { id } = await ctx.params;
  try {
    const session = await getSession("owner");
    if (!session) return json(401, "Your PayPal login expired. Log in again to ask for a review.");
    const deps = await liveDeps();
    const claim = await requestReview(deps, { claimId: id, payerId: session.payerId });
    const recall = await deps.store.getRecall(claim.recallId);
    if (!recall) return json(404, "This claim's recall is gone");
    return seeOther(claimPath(recall.slug, claim));
  } catch (e) {
    return fail(e);
  }
}
