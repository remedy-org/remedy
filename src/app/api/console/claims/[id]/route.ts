import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { company, fail, isResponse } from "@/app/console/_lib/api";
import { toDrawerClaim } from "@/app/console/_lib/drawer";
import { sealedPhotoUrl } from "@/app/console/_lib/photoToken";
import { claimAtVersion } from "@/app/console/_lib/photos";
import { canSee, canSeeClaim, loadClaimFor } from "@/app/console/_lib/workspace";
import { getAppStore } from "@/lib/demo";
import { ClaimId } from "@/lib/types";

const Version = z.coerce.number().int().min(1).max(10_000);

// GET /api/console/claims/RM-0412?v=12: the evidence panel's view of one claim. With the grid row's version, the claim
// comes from the data cache after its first read at that version (console/_lib/photos.ts), so walking the queue with
// ↑/↓ costs 1 Blob read a claim (its recall, read fresh for the refund it shows) and the second pass 1 too. Without
// it, as before: the claim and its recall, 2. The photos come with sealed tickets, so they never read the claim again.
export async function GET(request: NextRequest, ctx: RouteContext<"/api/console/claims/[id]">) {
  const session = await company();
  if (isResponse(session)) return session;
  const id = ClaimId.safeParse((await ctx.params).id);
  if (!id.success) return fail(404, "No claim with that id.");
  const v = Version.safeParse(request.nextUrl.searchParams.get("v"));

  let found: Awaited<ReturnType<typeof loadClaimFor>>;
  if (v.success) {
    const claim = await claimAtVersion(id.data, v.data).catch(() => null);
    const store = await getAppStore();
    const recall = claim ? await store.getRecall(claim.recallId, { fresh: true }) : null;
    found = claim && recall && canSee(recall, session) && canSeeClaim(recall, session)(claim) ? { store, claim, recall } : null;
  } else {
    found = await loadClaimFor(session, id.data, { fresh: true });
  }
  if (!found) return fail(404, "No claim with that id in this workspace.");
  const view = toDrawerClaim(found.claim, found.recall);
  view.photos = found.claim.photos.map((p, n) => sealedPhotoUrl(found.claim.id, n, p.key, session.payerId));
  return NextResponse.json(view, { headers: { "Cache-Control": "private, no-store" } });
}
