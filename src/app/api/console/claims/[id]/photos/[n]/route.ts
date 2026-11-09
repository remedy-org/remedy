import type { NextRequest } from "next/server";
import { z } from "zod";
import { company, fail, isResponse } from "@/app/console/_lib/api";
import { openPhoto } from "@/app/console/_lib/photoToken";
import { isPhotoWidth, resizedPhoto } from "@/app/console/_lib/photos";
import { getConsoleStore, loadClaimFor } from "@/app/console/_lib/workspace";
import { ClaimId } from "@/lib/types";

const Index = z.coerce.number().int().min(0).max(9);

// GET /api/console/claims/RM-0412/photos/0: a claim's photo, private to the company that owns the recall.
//   ?t=<ticket>  the grid's and the panel's sealed ticket (console/_lib/photoToken.ts): no claim read.
//   ?w=96|240|880  resized, from Next's data cache after the first time (console/_lib/photos.ts).
// Blob reads: with a ticket and a width, 0 once that photo and width were served (1 the first time, ever); without a
// ticket, the claim (1) as before, plus the photo; full size, the photo (1).
export async function GET(request: NextRequest, ctx: RouteContext<"/api/console/claims/[id]/photos/[n]">) {
  const session = await company();
  if (isResponse(session)) return session;
  const params = await ctx.params;
  const id = ClaimId.safeParse(params.id);
  const n = Index.safeParse(params.n);
  if (!id.success || !n.success) return fail(404, "No such photo.");
  const query = request.nextUrl.searchParams;
  const width = query.has("w") ? Number(query.get("w")) : null;
  if (width !== null && !isPhotoWidth(width)) return fail(400, "Photos come at widths 96, 240 or 880.");

  let key: string | undefined;
  const ticket = query.get("t");
  if (ticket) {
    const t = openPhoto(ticket, session.payerId);
    if (!t || t.claimId !== id.data || t.n !== n.data) return fail(404, "No such photo.");
    key = t.key;
  } else {
    const found = await loadClaimFor(session, id.data);
    key = found?.claim.photos[n.data]?.key;
    if (!key) return fail(404, "No such photo.");
  }

  if (width !== null) {
    const jpeg = await resizedPhoto(key, width);
    if (!jpeg) return fail(404, "The photo is missing from storage.");
    return new Response(new Uint8Array(jpeg), {
      // A key and width name the same bytes forever.
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400, immutable", "X-Content-Type-Options": "nosniff" },
    });
  }
  const jpeg = await (await getConsoleStore()).getPhoto(key);
  if (!jpeg) return fail(404, "The photo is missing from storage.");
  return new Response(new Uint8Array(jpeg), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
}
