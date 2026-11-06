import type { NextRequest } from "next/server";
import { getAppStore } from "@/lib/demo";
import { getSession } from "@/lib/session";
import { fail, json } from "../../../_lib/http";

// GET /api/claims/<id>/photos/<n>: one of the owner's own photos (private in the store), for the result screen.
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/claims/[id]/photos/[n]">) {
  const { id, n } = await ctx.params;
  try {
    const session = await getSession("owner");
    if (!session) return json(401, "Log in with PayPal to see this photo");
    const store = await getAppStore();
    const claim = await store.getClaim(id);
    const photo = claim && claim.payerId === session.payerId ? claim.photos[Number(n) - 1] : undefined;
    const jpeg = photo ? await store.getPhoto(photo.key) : null;
    if (!jpeg) return json(404, "No such photo");
    return new Response(new Uint8Array(jpeg), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" } });
  } catch (e) {
    return fail(e);
  }
}
