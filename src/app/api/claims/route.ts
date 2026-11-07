import type { NextRequest } from "next/server";
import { demoSample, isDemoAllowed } from "@/lib/demo";
import { refusalQuery } from "@/lib/limits";
import { getSession } from "@/lib/session";
import { getRecallBySlug } from "@/lib/store";
import { liveDeps } from "./_lib/deps";
import { fail, json, seeOther, toLogin } from "./_lib/http";
import { claimPath, createClaim, demoSampleOf, LimitReached } from "./_lib/pipeline";

// POST /api/claims (form: recall=<slug>, sample=<demo sample id>): files a demo claim with the sample's code.
// Real claims start at GET /api/claims/start, which continues an open claim instead of always making a new one.
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const slug = String(form?.get("recall") ?? "");
  const sample = demoSample(String(form?.get("sample") ?? ""));
  if (!sample) return json(400, "Pick one of the sample claims");
  try {
    const deps = await liveDeps();
    const recall = await getRecallBySlug(slug, deps.store);
    if (!recall || !isDemoAllowed(recall)) return json(404, "No such recall");
    const session = await getSession("owner");
    if (!session) return toLogin(`/r/${recall.slug}/try/samples`);
    // The picker's order, enforced here too: the repost needs this judge's genuine photo already sent.
    if (sample.after) {
      const rows = (await deps.store.listClaims()).filter((r) => r.demo && r.payerId === session.payerId && r.recallId === recall.id && r.photoHashes.length > 0);
      const sent = await Promise.all(rows.map((r) => deps.store.getClaim(r.id)));
      if (!sent.some((c) => c && demoSampleOf(c) === sample.after)) return json(409, `Send "${demoSample(sample.after)?.title}" first: this sample reposts its photo.`);
    }
    const claim = await createClaim(deps, { recall, payer: session, sample });
    return seeOther(claimPath(recall.slug, claim));
  } catch (e) {
    // Only reached once the demo recall was found by this slug. The picker says which limit, and when to come back.
    if (e instanceof LimitReached) return seeOther(`/r/${slug}/try/samples?${refusalQuery(e.refusal)}`);
    return fail(e);
  }
}
