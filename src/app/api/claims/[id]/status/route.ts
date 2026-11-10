import { NextResponse, type NextRequest } from "next/server";
import type { ClaimStatus } from "@/components/claim/model";
import { recheckPayout } from "@/components/claim/payout-live";
import { getAppStore } from "@/lib/demo";
import { getSession } from "@/lib/session";
import { fail, json } from "../../_lib/http";

// GET /api/claims/<id>/status: what the camera step polls to see photos sent from the phone, and what the paid receipt
// polls for PayPal's payout status. One Blob read a poll, the claim; GET /api/claims/<id> has the full checklist. For a
// payout that hasn't settled, PayPal is asked at most once a minute per claim per instance (payout-live.ts), and a
// changed status is saved, so the console shows it too. ?observe=1 only reads the stored claim: receipt recovery must
// never contact PayPal or save a payout update.
export async function GET(request: NextRequest, ctx: RouteContext<"/api/claims/[id]/status">) {
  const { id } = await ctx.params;
  try {
    const session = await getSession("owner");
    if (!session) return json(401, "Log in with PayPal to see this claim");
    const store = await getAppStore();
    const stored = await store.getClaim(id);
    if (!stored || stored.payerId !== session.payerId) return json(404, "No such claim for this PayPal account");
    const claim = new URL(request.url).searchParams.get("observe") === "1" ? stored : await recheckPayout(store, stored);
    const body: ClaimStatus = { decision: claim.decision, photos: claim.photos.length, ...(claim.payout ? { payout: claim.payout.status } : {}) };
    return NextResponse.json<ClaimStatus>(body, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}
