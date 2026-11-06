import type { NextRequest } from "next/server";
import { z } from "zod";
import { company, fail, isResponse } from "@/app/console/_lib/api";
import { loadClaimFor } from "@/app/console/_lib/workspace";
import { ClaimId } from "@/lib/types";

const Index = z.coerce.number().int().min(0).max(9);

// GET /api/console/claims/RM-0412/photos/0: a claim's photo, private to the company that owns the recall.
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/console/claims/[id]/photos/[n]">) {
  const session = await company();
  if (isResponse(session)) return session;
  const params = await ctx.params;
  const id = ClaimId.safeParse(params.id);
  const n = Index.safeParse(params.n);
  if (!id.success || !n.success) return fail(404, "No such photo.");
  const found = await loadClaimFor(session, id.data);
  const photo = found?.claim.photos[n.data];
  if (!found || !photo) return fail(404, "No such photo.");
  const jpeg = await found.store.getPhoto(photo.key);
  if (!jpeg) return fail(404, "The photo is missing from storage.");
  return new Response(new Uint8Array(jpeg), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
}
