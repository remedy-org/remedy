import type { NextRequest } from "next/server";
import { DEMO_ROUND_COOKIE, demoRoundCookie, demoSample, isDemoAllowed, newDemoRound, parseDemoRound } from "@/lib/demo";
import { refusalQuery } from "@/lib/limits";
import { getSession } from "@/lib/session";
import { getRecallBySlug } from "@/lib/store";
import { liveDeps } from "./_lib/deps";
import { fail, json, seeOther, toLogin } from "./_lib/http";
import { claimPath, createClaim, LimitReached, notYet, roundClaims } from "./_lib/pipeline";

// POST /api/claims (form: recall=<slug>, sample=<demo sample id>): files a demo claim with the sample's code, in the
// browser's demo round (src/lib/demo/round.ts).
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
    // The browser's round; one without (an API client, an expired cookie) starts one here.
    const round = parseDemoRound(request.cookies.get(DEMO_ROUND_COOKIE)?.value) ?? newDemoRound();
    // The picker's order, enforced here too: the repost needs this round's genuine photo already sent.
    if (sample.after) {
      const blocked = notYet(sample, roundClaims(await deps.store.listClaims(), recall.id, round));
      if (blocked) return json(409, blocked);
    }
    const claim = await createClaim(deps, { recall, payer: session, sample, round });
    const response = seeOther(claimPath(recall.slug, claim));
    response.cookies.set(DEMO_ROUND_COOKIE, round, demoRoundCookie());
    return response;
  } catch (e) {
    // Only reached once the demo recall was found by this slug. The picker says which limit, and when to come back.
    if (e instanceof LimitReached) return seeOther(`/r/${slug}/try/samples?${refusalQuery(e.refusal)}`);
    return fail(e);
  }
}
