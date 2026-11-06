import { NextResponse, type NextRequest } from "next/server";
import { toView } from "@/components/claim/model";
import { getSession } from "@/lib/session";
import { liveDeps } from "../_lib/deps";
import { fail, json } from "../_lib/http";
import { recoverStale } from "../_lib/pipeline";

// GET /api/claims/<id>: what the checking screen polls. Only the owner's own claim; never the payout key or session.
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/claims/[id]">) {
  const { id } = await ctx.params;
  try {
    const session = await getSession("owner");
    if (!session) return json(401, "Log in with PayPal to see this claim");
    const deps = await liveDeps();
    const stored = await deps.store.getClaim(id);
    if (!stored || stored.payerId !== session.payerId) return json(404, "No such claim for this PayPal account");
    const claim = await recoverStale(deps, stored);
    const recall = await deps.store.getRecall(claim.recallId);
    if (!recall) return json(404, "This claim's recall is gone");
    return NextResponse.json(toView(claim, recall.spec), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}
