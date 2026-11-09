import { after, NextResponse, type NextRequest } from "next/server";
import { toView } from "@/components/claim/model";
import { demoSample, isDemoAllowed } from "@/lib/demo";
import { getSession } from "@/lib/session";
import { liveDeps, samplePhotos } from "../../_lib/deps";
import { fail, json } from "../../_lib/http";
import { checkClaim, ClaimError, demoSampleOf, MAX_PHOTOS, receivePhotos } from "../../_lib/pipeline";

// The model call runs after the response (about 16 s, up to 40 s seen in the eval), then the payout.
export const maxDuration = 60;

// Vercel refuses request bodies over 4.5 MB; the browser downscales each photo to 1600 px JPEG first.
const MAX_BYTES = Math.floor(4.4 * 1024 * 1024);
// Sent as the session id when a demo sample is "sent in" from outside the camera page.
const OUTSIDE_SESSION = "cs_outside_this_claim";

// POST /api/claims/<id>/photos (multipart: sessionId, photo x1-3). Demo claims send no files: the server uses the
// claim's sample. Answers once the pre-checks are done and the photos are saved; the model and payout run after.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/claims/[id]/photos">) {
  const { id } = await ctx.params;
  try {
    const session = await getSession("owner");
    if (!session) return json(401, "Your PayPal login expired. Log in again to send the photos.");
    if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES) return json(413, "That was too large to send. Retake and send again.");

    const deps = await liveDeps();
    const claim = await deps.store.getClaim(id);
    if (!claim || claim.payerId !== session.payerId) return json(404, "No such claim for this PayPal account");
    const form = await request.formData().catch(() => null);
    if (!form) return json(400, "Nothing arrived. Send again.");

    let photos: Buffer[];
    let sessionId: string;
    if (claim.demo) {
      const recall = await deps.store.getRecall(claim.recallId);
      if (!recall || !isDemoAllowed(recall)) return json(404, "Demo claims run only on the demo recall");
      const sample = demoSample(demoSampleOf(claim) ?? "");
      if (!sample) throw new ClaimError(400, "This demo claim has no photos");
      photos = await samplePhotos(sample, request.nextUrl.origin);
      sessionId = sample.liveSession ? (claim.captureSession?.id ?? "") : OUTSIDE_SESSION;
    } else {
      const files = form.getAll("photo").filter((f): f is File => f instanceof File);
      if (files.length < 1 || files.length > MAX_PHOTOS) return json(400, `Send 1 to ${MAX_PHOTOS} photos`);
      if (files.some((f) => f.type !== "image/jpeg")) return json(400, "Photos must come from this page's camera");
      photos = await Promise.all(files.map(async (f) => Buffer.from(await f.arrayBuffer())));
      sessionId = String(form.get("sessionId") ?? "");
    }

    const received = await receivePhotos(deps, { claimId: id, payerId: session.payerId, sessionId, photos });
    if (received.decision === "pending") {
      after(async () => {
        try {
          await checkClaim(deps, id);
        } catch (e) {
          // The claim keeps its photos; GET /api/claims/<id> holds it for a person once it's stale.
          console.error(`Check for claim ${id} failed:`, e instanceof Error ? e.message : e);
        }
      });
    }
    const recall = await deps.store.getRecall(received.recallId);
    return NextResponse.json(recall ? toView(received, recall.spec) : null, { status: 202 });
  } catch (e) {
    return fail(e);
  }
}
