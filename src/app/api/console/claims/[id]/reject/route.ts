import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { body, company, fail, isResponse, reviewer } from "@/app/console/_lib/api";
import { toDrawerClaim, type ReviewedClaim } from "@/app/console/_lib/drawer";
import { rejectClaim } from "@/app/console/_lib/review";
import { loadClaimFor } from "@/app/console/_lib/workspace";
import { ClaimId } from "@/lib/types";

const RejectInput = z.object({
  reason: z.string().trim().min(8, "Say why in a few words, so the owner knows what to fix").max(280, "Keep it under 280 characters"),
});

// POST /api/console/claims/RM-0412/reject {reason}: a person rejects a held claim. No money moves.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/console/claims/[id]/reject">) {
  const session = await company();
  if (isResponse(session)) return session;
  const id = ClaimId.safeParse((await ctx.params).id);
  if (!id.success) return fail(404, "No claim with that id.");
  const input = await body(request, RejectInput);
  if (isResponse(input)) return input;
  const found = await loadClaimFor(session, id.data);
  if (!found) return fail(404, "No claim with that id in this workspace.");

  const result = await rejectClaim({ ...found, by: reviewer(session), reason: input.reason });
  if (!result.ok) return fail(result.status, result.message);
  return NextResponse.json<ReviewedClaim>({ ...toDrawerClaim(result.claim, found.recall), ...(result.sample ? { sample: result.sample } : {}) });
}
