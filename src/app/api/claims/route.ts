import type { NextRequest } from "next/server";
import { demoSample } from "@/lib/demo";
import { getSession } from "@/lib/session";
import { getRecallBySlug } from "@/lib/store";
import { liveDeps } from "./_lib/deps";
import { fail, json, seeOther, toLogin } from "./_lib/http";
import { claimPath, createClaim } from "./_lib/pipeline";

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
    if (!recall) return json(404, "No such recall");
    const session = await getSession("owner");
    if (!session) return toLogin(`/r/${recall.slug}/try/samples`);
    const claim = await createClaim(deps, { recall, payer: session, sample });
    return seeOther(claimPath(recall.slug, claim));
  } catch (e) {
    return fail(e);
  }
}
