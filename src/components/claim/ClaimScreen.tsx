import "server-only";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import QRCode from "qrcode";
import { roundClaims } from "@/app/api/claims/_lib/pipeline";
import { demoSample, getAppStore, isDemoAllowed } from "@/lib/demo";
import { env } from "@/lib/env";
import { getPayoutStatus } from "@/lib/paypal/payouts";
import { isTerminal, savePayoutStatus } from "@/lib/paypal/status";
import { getDemoRound, getSession, loginPath } from "@/lib/session";
import { getRecallBySlug, type Store } from "@/lib/store";
import type { Claim, Recall } from "@/lib/types";
import { ClaimFlow } from "./ClaimFlow";
import { ExpiredCard } from "./ExpiredCard";
import { FlowShell } from "./FlowShell";
import { WithJudges } from "./Judges";
import { checkRows, companyName, RECEIPT_LIVE_MS, toView } from "./model";
import { markAsked } from "./payout-live";
import { Result, type DemoRound, type PayoutLive } from "./Result";
import { DEMO_STEPS, REAL_STEPS, StepMeter } from "./StepMeter";

const QR_COLORS = { dark: "#15181d", light: "#ffffff" };
// Request time: this page is rendered per request (it reads the session cookie), never cached.
const requestTime = () => Date.now();

// PayPal's live status for the receipt; the stored one if PayPal is slow or down (a partial result, never an error).
// A settled payout isn't asked about again: a later refund or reversal arrives by webhook. A new status is saved
// after the response, so the console shows it too; an unchanged one isn't, since saving rereads the claim. A payout
// sent in the last 10 minutes that hasn't settled stays live: the receipt keeps asking (ReceiptLive, payout-live.ts).
async function livePayout(store: Store, claim: Claim, now: number): Promise<PayoutLive | undefined> {
  if (!claim.payout) return undefined;
  if (claim.payout.batchId.startsWith("SEED") || isTerminal(claim.payout.status)) return { status: claim.payout.status, fresh: true };
  const { batchId } = claim.payout;
  const sentAt = claim.events.find((e) => e.type === "payout_sent")?.at ?? claim.payout.updatedAt;
  const recent = now - Date.parse(sentAt) < RECEIPT_LIVE_MS;
  markAsked(claim.id, now);
  try {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 4000));
    const s = await Promise.race([getPayoutStatus(batchId), timeout]);
    const status = s.itemStatus ?? s.batchStatus;
    if (status !== claim.payout.status) after(() => savePayoutStatus(store, claim.id, batchId, { status, itemId: s.itemId, at: new Date() }).catch(() => undefined));
    return { status, fresh: true, live: recent && !isTerminal(status) };
  } catch {
    return { status: claim.payout.status, fresh: false, live: recent };
  }
}

// This browser's demo round (the cookie the proxy sets), from index.json: one read, only on a demo claim's result.
async function demoRound(store: Store, recall: Recall, payerId: string): Promise<DemoRound> {
  const round = await getDemoRound();
  const rows = round ? roundClaims(await store.listClaims(), recall.id, round, payerId) : [];
  return { runs: rows.filter((r) => r.photoHashes.length > 0 && r.sample).map((r) => ({ sample: r.sample!, decision: r.decision })) };
}

/** One claim, owner only: the open steps (code, camera, checking) in the browser, or the result. */
export async function ClaimScreen({ slug, id, demo }: { slug: string; id: string; demo: boolean }) {
  const store = await getAppStore();
  const recall = await getRecallBySlug(slug, store);
  if (!recall || (demo && !isDemoAllowed(recall))) notFound();

  const here = `/r/${recall.slug}/${demo ? "try" : "claim"}/${id}`;
  const session = await getSession("owner");
  if (!session) redirect(loginPath("owner", here));
  const claim = await store.getClaim(id);
  if (!claim || claim.payerId !== session.payerId || claim.recallId !== recall.id) notFound();
  if (Boolean(claim.demo) !== demo) redirect(`/r/${recall.slug}/${claim.demo ? "try" : "claim"}/${claim.id}`);

  const sample = claim.demo ? demoSample(claim.events.find((e) => e.type === "demo_sample")?.detail ?? "") : null;
  const againHref = demo ? `/r/${recall.slug}/try/samples` : `/api/claims/start?recall=${recall.slug}`;
  const company = companyName(recall);
  const steps = demo ? DEMO_STEPS : REAL_STEPS;
  const now = requestTime();

  if (claim.decision !== "pending") {
    // A demo claim's photos are the sample's own public files: shown from there, they cost no Blob reads.
    const photoUrls = claim.photos.map((_, i) => (sample ? (sample.photos[i] ?? sample.photos[0]) : `/api/claims/${claim.id}/photos/${i + 1}`));
    const [payout, round] = await Promise.all([livePayout(store, claim, now), sample ? demoRound(store, recall, session.payerId) : null]);
    return (
      <FlowShell demo={demo} company={company}>
        <Result
          claim={claim}
          recall={recall}
          rows={checkRows(claim, recall.spec)}
          photoUrls={photoUrls}
          payout={payout}
          againHref={againHref}
          sample={sample}
          round={round}
          now={now}
          meter={<StepMeter current={steps.length + 1} steps={steps} />}
        />
      </FlowShell>
    );
  }

  const session10 = claim.captureSession;
  if (!claim.photos.length && (!session10 || Date.parse(session10.expiresAt) <= now)) {
    return (
      <FlowShell demo={demo} company={company}>
        <WithJudges demo={demo} step="code">
          <div className="flex flex-col gap-6">
            <StepMeter current={demo ? 3 : 2} steps={steps} className="mx-auto w-full max-w-claim" />
            <ExpiredCard code={claim.code} againHref={againHref} demo={demo} />
          </div>
        </WithJudges>
      </FlowShell>
    );
  }

  const phoneUrl = new URL(here, env().APP_URL).toString();
  const qrSvg = demo ? "" : await QRCode.toString(phoneUrl, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: QR_COLORS });
  return (
    <FlowShell demo={demo} company={company}>
      <ClaimFlow
        claimId={claim.id}
        code={claim.code}
        sessionId={session10?.id ?? ""}
        expiresAt={session10?.expiresAt ?? new Date(now).toISOString()}
        startNow={now}
        spec={recall.spec}
        view={toView(claim, recall.spec)}
        qrSvg={qrSvg}
        phoneUrl={phoneUrl}
        newClaimHref={againHref}
        loginHref={loginPath("owner", here)}
        sample={sample}
      />
    </FlowShell>
  );
}
