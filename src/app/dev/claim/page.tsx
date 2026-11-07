import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import type { ReactNode } from "react";
import { ClaimFlow, type ClaimFlowProps } from "@/components/claim/ClaimFlow";
import { ExpiredCard } from "@/components/claim/ExpiredCard";
import { FlowShell } from "@/components/claim/FlowShell";
import { FlowSkeleton } from "@/components/claim/FlowSkeleton";
import { checkRows, toView } from "@/components/claim/model";
import { NotFoundCard } from "@/components/claim/NotFoundCard";
import { RecallView } from "@/components/claim/RecallScreen";
import { Result, type ResultProps } from "@/components/claim/Result";
import { SamplePicker } from "@/components/claim/SamplePicker";
import { DEMO_STEPS, REAL_STEPS, StepMeter } from "@/components/claim/StepMeter";
import { Button, ErrorState } from "@/components/ui";
import { DEMO_SAMPLES, demoSample } from "@/lib/demo";
import { nextUtcDay } from "@/lib/limits";
import type { Claim } from "@/lib/types";
import * as fx from "./fixtures";

// /dev/claim?s=<state>: every step and result of the owner's claim flow with fixtures, for screenshots and review.
// Dev only: a 404 in production.

const SHOTS = ["/demo/c02-1.jpg", "/demo/c03-2.jpg"];

type Render = () => ReactNode | Promise<ReactNode>;

async function flow(over: Partial<ClaimFlowProps> & Pick<ClaimFlowProps, "preview">, claim: Claim = fx.open) {
  const phoneUrl = `http://127.0.0.1:3000/r/${fx.recall.slug}/claim/${claim.id}`;
  return (
    <FlowShell demo={Boolean(over.sample)} company="Kikea Store">
      <ClaimFlow
        claimId={claim.id}
        code={claim.code}
        sessionId="cs_preview"
        expiresAt={claim.captureSession!.expiresAt}
        startNow={fx.NOW}
        spec={fx.recall.spec}
        view={toView(claim, fx.recall.spec)}
        qrSvg={await QRCode.toString(phoneUrl, { type: "svg", margin: 0, color: { dark: "#15181d", light: "#ffffff" } })}
        phoneUrl={phoneUrl}
        newClaimHref="#"
        loginHref="#"
        {...over}
      />
    </FlowShell>
  );
}

function result(d: { claim: Claim; photoUrls: string[] }, over: Partial<ResultProps> = {}) {
  const demo = Boolean(over.sample);
  const steps = demo ? DEMO_STEPS : REAL_STEPS;
  return (
    <FlowShell demo={demo} company="Kikea Store">
      <div className="flex flex-col gap-6">
        <StepMeter current={steps.length + 1} steps={steps} />
        <Result claim={d.claim} recall={fx.recall} rows={checkRows(d.claim, fx.recall.spec)} photoUrls={d.photoUrls} againHref="#" {...over} />
      </div>
    </FlowShell>
  );
}

const consent = (over: Partial<Parameters<typeof RecallView>[0]> = {}) => <RecallView recall={fx.recall} href="#" {...over} />;
const genuine = demoSample("genuine")!;

const STATES: Record<string, { group: string; note: string; render: Render }> = {
  consent: { group: "Recall", note: "Logged out", render: () => consent() },
  "consent-signed-in": { group: "Recall", note: "Already logged in with PayPal", render: () => consent({ signedInAs: "Pat Doe" }) },
  "consent-denied": { group: "Recall", note: "PayPal login cancelled", render: () => consent({ authError: "denied" }) },
  "consent-unverified": { group: "Recall", note: "Unverified PayPal account", render: () => consent({ signedInAs: "Pat Doe", unverified: true }) },
  "consent-limit": { group: "Recall", note: "Claim start refused: account's daily limit", render: () => consent({ signedInAs: "Pat Doe", refusal: { kind: "account", limit: 5, until: nextUtcDay(new Date()) } }) },
  "demo-consent": { group: "Recall", note: "Demo mode", render: () => consent({ demo: true }) },
  picker: {
    group: "Demo",
    note: "Sample picker, first visit",
    render: () => (
      <FlowShell demo company="Kikea Store">
        <div className="flex flex-col gap-6">
          <StepMeter current={2} steps={DEMO_STEPS} />
          <SamplePicker
            slug={fx.recall.slug}
            selected="genuine"
            runs={[]}
            options={DEMO_SAMPLES.map((sample) => ({ sample, locked: sample.after ? `Send "A genuine claim" first: this one reposts its photo.` : undefined }))}
          />
        </div>
      </FlowShell>
    ),
  },
  "picker-runs": {
    group: "Demo",
    note: "Sample picker after two runs",
    render: () => (
      <FlowShell demo company="Kikea Store">
        <div className="flex flex-col gap-6">
          <StepMeter current={2} steps={DEMO_STEPS} />
          <SamplePicker
            slug={fx.recall.slug}
            selected="ai-no-session"
            runs={[
              { id: "RM-5307", href: "#", title: "The wrong code", decision: "rejected" },
              { id: "RM-4127", href: "#", title: "A genuine claim", decision: "paid" },
            ]}
            options={DEMO_SAMPLES.map((sample) => ({ sample }))}
          />
        </div>
      </FlowShell>
    ),
  },
  "picker-limit": {
    group: "Demo",
    note: "Sample claim refused: today's photo checks used up",
    render: () => (
      <FlowShell demo company="Kikea Store">
        <div className="flex flex-col gap-6">
          <StepMeter current={2} steps={DEMO_STEPS} />
          <SamplePicker
            slug={fx.recall.slug}
            selected="genuine"
            runs={[]}
            options={DEMO_SAMPLES.map((sample) => ({ sample }))}
            refusal={{ kind: "checks", limit: 100, until: nextUtcDay(new Date()) }}
          />
        </div>
      </FlowShell>
    ),
  },
  code: { group: "Code", note: "Code and session timer", render: () => flow({ preview: { phase: "code" } }) },
  "demo-code": { group: "Code", note: "Demo: the sample's code", render: () => flow({ sample: genuine, preview: { phase: "code" } }) },
  ...Object.fromEntries(
    DEMO_SAMPLES.filter((s) => s.id !== "genuine").map((sample) => [
      `demo-code-${sample.id}`,
      { group: "Code", note: `Demo: ${sample.title.toLowerCase()}`, render: () => flow({ sample, preview: { phase: "code" } }, { ...fx.open, code: sample.code ?? "H6W" }) },
    ]),
  ),
  expired: {
    group: "Code",
    note: "Session ended before any photo",
    render: () => (
      <FlowShell company="Kikea Store">
        <div className="flex flex-col gap-6">
          <StepMeter current={2} />
          <ExpiredCard code="M4T" againHref="#" />
        </div>
      </FlowShell>
    ),
  },
  "camera-starting": { group: "Camera", note: "Asking for permission", render: () => flow({ preview: { phase: "capture", capture: { camera: "starting" } } }) },
  "camera-live": { group: "Camera", note: "Live, no shots yet", render: () => flow({ preview: { phase: "capture", capture: { camera: "live", still: "/demo/c02-1.jpg" } } }) },
  "camera-shots": { group: "Camera", note: "Two shots taken", render: () => flow({ preview: { phase: "capture", capture: { camera: "live", still: "/demo/c02-1.jpg", shots: SHOTS } } }) },
  "camera-sending": { group: "Camera", note: "Uploading", render: () => flow({ preview: { phase: "capture", capture: { camera: "live", still: "/demo/c02-1.jpg", shots: SHOTS, sending: true } } }) },
  "camera-send-error": {
    group: "Camera",
    note: "Upload failed",
    render: () => flow({ preview: { phase: "capture", capture: { camera: "live", still: "/demo/c02-1.jpg", shots: SHOTS.slice(0, 1), sendError: "No connection. Your photos are still here: send them again when you're back online." } } }),
  },
  "camera-phone": { group: "Camera", note: "Continue on a phone (QR)", render: () => flow({ preview: { phase: "capture", capture: { camera: "live", still: "/demo/c02-1.jpg", showPhone: true } } }) },
  "camera-denied": { group: "Camera", note: "Permission denied", render: () => flow({ preview: { phase: "capture", capture: { camera: "denied" } } }) },
  "camera-nocamera": { group: "Camera", note: "No camera on this device", render: () => flow({ preview: { phase: "capture", capture: { camera: "nocamera" } } }) },
  "camera-error": { group: "Camera", note: "Camera in use elsewhere", render: () => flow({ preview: { phase: "capture", capture: { camera: "error" } } }) },
  "camera-expired": {
    group: "Camera",
    note: "Timer ran out on the camera",
    render: () => flow({ preview: { phase: "capture", capture: { camera: "live" } } }, { ...fx.open, captureSession: { id: "cs_preview", expiresAt: new Date(fx.NOW - 1000).toISOString() } }),
  },
  "demo-capture": { group: "Camera", note: "Demo: the sample in the viewfinder", render: () => flow({ sample: genuine, preview: { phase: "capture" } }) },
  "checking-model": { group: "Checking", note: "Pre-checks passed, model running", render: () => flow({ preview: { phase: "checking", checking: { elapsed: 6 } } }, fx.checkingModel) },
  "checking-offline": { group: "Checking", note: "Polling lost the connection", render: () => flow({ preview: { phase: "checking", checking: { elapsed: 21, offline: true } } }, fx.checkingModel) },
  "checking-done": { group: "Checking", note: "All checks resolved", render: () => flow({ preview: { phase: "checking", checking: { elapsed: 19 } } }, fx.paid.claim) },
  "checking-blocked": { group: "Checking", note: "Stopped by a pre-check", render: () => flow({ preview: { phase: "checking", checking: { elapsed: 1 } } }, fx.blocked.claim) },
  paid: { group: "Result", note: "Paid, payout processing", render: () => result(fx.paid, { payout: { status: "PENDING", fresh: true } }) },
  "paid-received": { group: "Result", note: "Paid, payout received", render: () => result(fx.paid, { payout: { status: "SUCCESS", fresh: true } }) },
  "paid-partial": { group: "Result", note: "Paid, PayPal status unreachable", render: () => result(fx.paid, { payout: { status: "PENDING", fresh: false } }) },
  held: { group: "Result", note: "Held: unclear answers", render: () => result(fx.held) },
  "held-model": { group: "Result", note: "Held: the model was down", render: () => result(fx.heldModel) },
  "held-limit": { group: "Result", note: "Held: the daily photo-check limit was reached", render: () => result(fx.heldLimit) },
  "held-payout": { group: "Result", note: "Held: PayPal refused the payout", render: () => result(fx.heldPayout) },
  rejected: { group: "Result", note: "Rejected: wrong code", render: () => result(fx.rejected) },
  "rejected-screen": { group: "Result", note: "Rejected: photo of a screen", render: () => result(fx.rejectedScreen) },
  blocked: { group: "Result", note: "Blocked: outside the camera session", render: () => result(fx.blocked) },
  "blocked-account": { group: "Result", note: "Blocked: repost from a paid account", render: () => result(fx.blockedAccount) },
  "demo-paid": { group: "Result", note: "Demo: genuine sample paid", render: () => result(fx.paid, { sample: genuine, payout: { status: "SUCCESS", fresh: true } }) },
  "demo-blocked": { group: "Result", note: "Demo: AI image refused", render: () => result(fx.blocked, { sample: demoSample("ai-no-session") }) },
  loading: { group: "States", note: "Loading skeleton: a step", render: () => <FlowSkeleton /> },
  "loading-recall": { group: "States", note: "Loading skeleton: the recall screen", render: () => <FlowSkeleton wide /> },
  "not-found": { group: "States", note: "Unknown link", render: () => <FlowShell><NotFoundCard /></FlowShell> },
  error: {
    group: "States",
    note: "Page failed to render",
    render: () => (
      <FlowShell>
        <ErrorState
          title="This page didn't load"
          description="Something on our side didn't answer. Any claim you started is saved, and photos already sent are still being checked. Try again in a moment."
          action={<Button variant="secondary">Try again</Button>}
          className="bg-surface"
        />
      </FlowShell>
    ),
  },
};

export const metadata = { title: "Claim flow previews", robots: { index: false } };

export default async function DevClaimPage({ searchParams }: PageProps<"/dev/claim">) {
  if (process.env.NODE_ENV === "production") notFound();
  const s = (await searchParams).s;
  const state = typeof s === "string" ? STATES[s] : undefined;
  if (state) return state.render();

  const groups = [...new Set(Object.values(STATES).map((x) => x.group))];
  return (
    <main className="mx-auto max-w-content px-4 py-12 sm:px-8">
      <h1 className="text-h2 font-semibold">Claim flow previews</h1>
      <p className="mt-2 text-body text-muted">Every step and result with fixtures. Model answers are real stored ones from the eval.</p>
      <div className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <section key={g}>
            <h2 className="micro border-b border-line pb-2 text-faint">{g}</h2>
            <ul>
              {Object.entries(STATES)
                .filter(([, x]) => x.group === g)
                .map(([key, x]) => (
                  <li key={key} className="border-b border-line">
                    <Link href={`/dev/claim?s=${key}`} className="flex min-h-11 items-center justify-between gap-3 text-ui text-text hover:text-accent-text">
                      <span>{x.note}</span>
                      <span className="font-mono text-micro text-faint">{key}</span>
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
