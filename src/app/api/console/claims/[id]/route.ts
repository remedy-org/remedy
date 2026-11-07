import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { company, fail, isResponse } from "@/app/console/_lib/api";
import { duplicateFor, toDrawerClaim } from "@/app/console/_lib/drawer";
import { sealedPhotoUrl } from "@/app/console/_lib/photoToken";
import { claimAtVersion } from "@/app/console/_lib/photos";
import { approveConflicts } from "@/app/console/_lib/review";
import { canSee, canSeeClaim, loadClaimFor } from "@/app/console/_lib/workspace";
import { getAppStore } from "@/lib/demo";
import { ClaimId } from "@/lib/types";

const Version = z.coerce.number().int().min(1).max(10_000);

// GET /api/console/claims/RM-0412?v=12: the evidence panel's view of one claim. With the grid row's version, the claim
// comes from the data cache after its first read at that version (console/_lib/photos.ts), and its recall from the
// 60-second recall cache (it only shows the refund; approve and reject read the recall fresh in their own routes). So
// walking the queue with ↑/↓ costs 1 Blob read a new claim and none on a second pass. Without it, as before: the claim
// and its recall, 2. The photos come with sealed tickets, so they never read the claim again. A held claim a person can
// pay reads the index too (1 more), for what approve's checks would stop now: the panel says so before the decision.
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
    const recall = claim ? await store.getRecall(claim.recallId) : null;
    found = claim && recall && canSee(recall, session) && canSeeClaim(recall, session)(claim) ? { store, claim, recall } : null;
  } else {
    found = await loadClaimFor(session, id.data, { fresh: true });
  }
  if (!found) return fail(404, "No claim with that id in this workspace.");
  const reviewable = found.claim.decision === "held" && !found.claim.seeded;
  const blockedRepost = found.claim.decision === "blocked" && found.claim.reasons.some((r) => r.check === "duplicate_photo");
  const rows = reviewable || blockedRepost ? await found.store.listClaims() : [];
  const stops = reviewable ? approveConflicts(found.claim, rows).map((r) => r.text) : [];
  const view = toDrawerClaim(found.claim, found.recall, { stops });
  view.photos = found.claim.photos.map((p, n) => sealedPhotoUrl(found.claim.id, n, p.key, session.payerId));
  // A blocked repost shows the earlier claim's matching photo beside its own: one index read, for these claims only.
  if (blockedRepost) {
    const dup = duplicateFor(found.claim, rows);
    const key = dup && rows.find((r) => r.id === dup.id)?.photoKeys?.[dup.theirs - 1];
    view.duplicate = dup && { ...dup, src: key ? sealedPhotoUrl(dup.id, dup.theirs - 1, key, session.payerId) : null };
  }
  return NextResponse.json(view, { headers: { "Cache-Control": "private, no-store" } });
}
