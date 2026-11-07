import { NextResponse, type NextRequest } from "next/server";
import { company, fail, isResponse } from "@/app/console/_lib/api";
import { toDrawerClaim } from "@/app/console/_lib/drawer";
import { loadClaimFor } from "@/app/console/_lib/workspace";
import { ClaimId } from "@/lib/types";

// GET /api/console/claims/RM-0412: the evidence drawer's view of one claim.
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/console/claims/[id]">) {
  const session = await company();
  if (isResponse(session)) return session;
  const id = ClaimId.safeParse((await ctx.params).id);
  if (!id.success) return fail(404, "No claim with that id.");
  const found = await loadClaimFor(session, id.data, { fresh: true });
  if (!found) return fail(404, "No claim with that id in this workspace.");
  return NextResponse.json(toDrawerClaim(found.claim, found.recall), { headers: { "Cache-Control": "private, no-store" } });
}
