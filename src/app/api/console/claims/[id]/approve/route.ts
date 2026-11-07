import { NextResponse, type NextRequest } from "next/server";
import { company, fail, isResponse, reviewer } from "@/app/console/_lib/api";
import { toDrawerClaim, type ReviewedClaim } from "@/app/console/_lib/drawer";
import { approveClaim } from "@/app/console/_lib/review";
import { loadClaimFor } from "@/app/console/_lib/workspace";
import { ClaimId } from "@/lib/types";

// POST /api/console/claims/RM-0412/approve: a person approves a held claim; Remedy re-checks, then pays through PayPal.
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/console/claims/[id]/approve">) {
  const session = await company();
  if (isResponse(session)) return session;
  const id = ClaimId.safeParse((await ctx.params).id);
  if (!id.success) return fail(404, "No claim with that id.");
  const found = await loadClaimFor(session, id.data, { fresh: true });
  if (!found) return fail(404, "No claim with that id in this workspace.");

  const result = await approveClaim({ ...found, by: reviewer(session) });
  if (!result.ok) {
    const reasons = result.reasons?.map((r) => r.text);
    return fail(result.status, reasons?.length ? `${result.message} ${reasons.join("; ")}.` : result.message, {
      ...(result.reference ? { reference: result.reference } : {}),
      ...(reasons?.length ? { reasons } : {}),
    });
  }
  return NextResponse.json<ReviewedClaim>({ ...toDrawerClaim(result.claim, found.recall), ...(result.sample ? { sample: result.sample } : {}) });
}
