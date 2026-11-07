import { NextResponse, type NextRequest } from "next/server";
import type { ClaimStatus } from "@/components/claim/model";
import { getAppStore } from "@/lib/demo";
import { getSession } from "@/lib/session";
import { fail, json } from "../../_lib/http";

// GET /api/claims/<id>/status: what the camera step polls to see photos sent from the phone. Reads the claim only,
// one Blob read a poll; GET /api/claims/<id> has the full checklist.
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/claims/[id]/status">) {
  const { id } = await ctx.params;
  try {
    const session = await getSession("owner");
    if (!session) return json(401, "Log in with PayPal to see this claim");
    const claim = await (await getAppStore()).getClaim(id);
    if (!claim || claim.payerId !== session.payerId) return json(404, "No such claim for this PayPal account");
    return NextResponse.json<ClaimStatus>({ decision: claim.decision, photos: claim.photos.length }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}
