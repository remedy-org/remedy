import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import type { ReactNode } from "react";
import { ClaimErrorCard } from "@/components/claim/ClaimErrorCard";
import { ClaimFlow, type ClaimFlowProps } from "@/components/claim/ClaimFlow";
import { ContinueCard } from "@/components/claim/ContinueCard";
import { ExpiredCard } from "@/components/claim/ExpiredCard";
import { FlowShell } from "@/components/claim/FlowShell";
import { FlowSkeleton } from "@/components/claim/FlowSkeleton";
import { WithJudges } from "@/components/claim/Judges";
import { checkRows, toView } from "@/components/claim/model";
import { NotFoundCard } from "@/components/claim/NotFoundCard";
import { RecallView } from "@/components/claim/RecallScreen";
import { Result, type ResultProps } from "@/components/claim/Result";
import { SamplePicker } from "@/components/claim/SamplePicker";
import { DEMO_STEPS, REAL_STEPS, resultMeter, StepMeter } from "@/components/claim/StepMeter";
import { DEMO_SAMPLES, demoSample, isSandboxBuild } from "@/lib/demo";
import { nextUtcDay } from "@/lib/limits";
import { activityUrl } from "@/lib/paypal/identity";
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
  // A demo claim shows its sample's own photo, as ClaimScreen does.
  const photoUrls = over.sample ? d.photoUrls.map(() => over.sample!.photos[0]) : d.photoUrls;
  return (
    <FlowShell demo={demo} company="Kikea Store">
      <Result
        claim={d.claim}
        recall={fx.recall}
        rows={checkRows(d.claim, fx.recall.spec)}
        photoUrls={photoUrls}
        againHref="#"
        now={fx.NOW + 10 * 60_000}
        meter={<StepMeter {...resultMeter(d.claim.decision, steps)} steps={steps} />}
        sandbox={isSandboxBuild()}
        activityUrl={isSandboxBuild() && d.claim.decision === "paid" ? activityUrl() : undefined}
        {...over}
      />
    </FlowShell>
  );
}

const picker = (props: Omit<Parameters<typeof SamplePicker>[0], "slug">) => (
  <FlowShell demo company="Kikea Store">
    <WithJudges demo step="samples">
      <div className="flex flex-col gap-6">
        <StepMeter current={2} steps={DEMO_STEPS} />
        <SamplePicker slug={fx.recall.slug} {...props} />
      </div>
    </WithJudges>
  </FlowShell>
);

const consent = (over: Partial<Parameters<typeof RecallView>[0]> = {}) => <RecallView recall={fx.recall} href="#" {...over} />;
const genuine = demoSample("genuine")!;
const handoff = (signedInAs?: string) => (
  <FlowShell company="Kikea Store">
    <ContinueCard id={fx.open.id} product="X-VESOLJE Nursing Pillow" company="Kikea Store" loginHref="#" expiresAt={new Date(Date.now() + 8 * 60_000 + 12_000).toISOString()} startNow={Date.now()} signedInAs={signedInAs} />
  </FlowShell>
);

const run = (id: string, sample: string, decision: Claim["decision"]) => ({ id, href: "#", title: demoSample(sample)!.title, decision, sample });
const locked = (sample: (typeof DEMO_SAMPLES)[number]) => (sample.after ? `Send "A genuine claim" first: this one reposts its photo.` : undefined);
const wrongCode = demoSample("wrong-code")!;
const reposted = demoSample("reposted")!;

const STATES: Record<string, { group: string; note: string; render: Render }> = {
  consent: { group: "Recall", note: "Logged out", render: () => consent() },
  "consent-signed-in": { group: "Recall", note: "Already logged in with PayPal", render: () => consent({ signedInAs: "Pat Doe" }) },
  "consent-denied": { group: "Recall", note: "PayPal login cancelled", render: () => consent({ authError: "denied" }) },
  "consent-unverified": { group: "Recall", note: "Unverified PayPal account", render: () => consent({ signedInAs: "Pat Doe", unverified: true }) },
  "consent-limit": { group: "Recall", note: "Claim start refused: account's daily limit", render: () => consent({ signedInAs: "Pat Doe", refusal: { kind: "account", limit: 5, until: nextUtcDay(new Date()) } }) },
  "consent-returning": {
    group: "Recall",
    note: "Back from the notice with a held claim",
    render: () => consent({ signedInAs: "Pat Doe", yourClaim: { id: "RM-0996", href: "#", decision: "held", photos: 1, decideBy: "Tue 10 Nov" } }),
  },
  "consent-returning-paid": {
    group: "Recall",
    note: "Back from the notice with a paid claim",
    render: () => consent({ signedInAs: "Pat Doe", yourClaim: { id: "RM-0442", href: "#", decision: "paid", photos: 1, paidOn: "7 Nov 2026" } }),
  },
  "demo-consent": { group: "Recall", note: "Demo mode", render: () => consent({ demo: true }) },
  "demo-consent-signed-in": { group: "Recall", note: "Demo mode, logged in", render: () => consent({ demo: true, signedInAs: "Pat Doe" }) },
  picker: {
    group: "Demo",
    note: "Sample picker, first visit (repost locked)",
    render: () => picker({ selected: "genuine", runs: [], roundDone: false, options: DEMO_SAMPLES.map((sample) => ({ sample, locked: locked(sample) })) }),
  },
  "picker-runs": {
    group: "Demo",
    note: "Sample picker after two runs: scoreboard",
    render: () =>
      picker({
        selected: "ai-no-session",
        runs: [run("RM-5307", "wrong-code", "rejected"), run("RM-4127", "genuine", "paid")],
        roundDone: false,
        options: DEMO_SAMPLES.map((sample) => ({ sample })),
      }),
  },
  "picker-locked-runs": {
    group: "Demo",
    note: "The AC state: a run scored, the repost locked",
    render: () =>
      picker({
        selected: "genuine",
        runs: [run("RM-5309", "ai-no-session", "blocked"), run("RM-5307", "wrong-code", "rejected")],
        roundDone: false,
        options: DEMO_SAMPLES.map((sample) => ({ sample, locked: locked(sample) })),
      }),
  },
  "picker-unexpected": {
    group: "Demo",
    note: "Scoreboard with one outcome not as expected",
    render: () =>
      picker({
        selected: "wrong-code",
        runs: [run("RM-4127", "genuine", "held")],
        roundDone: false,
        options: DEMO_SAMPLES.map((sample) => ({ sample })),
      }),
  },
  "picker-done": {
    group: "Demo",
    note: "Sample picker after all four samples ran",
    render: () =>
      picker({
        selected: "genuine",
        runs: [run("RM-5310", "reposted", "blocked"), run("RM-5309", "ai-no-session", "blocked"), run("RM-5307", "wrong-code", "rejected"), run("RM-4127", "genuine", "paid")],
        roundDone: true,
        options: DEMO_SAMPLES.map((sample) => ({ sample })),
      }),
  },
  "picker-limit": {
    group: "Demo",
    note: "Sample claim refused: today's photo checks used up",
    render: () => picker({ selected: "genuine", runs: [], roundDone: false, options: DEMO_SAMPLES.map((sample) => ({ sample })), refusal: { kind: "checks", limit: 100, until: nextUtcDay(new Date()) } }),
  },
  handoff: { group: "Code", note: "Phone from the QR, logged out: time left", render: () => handoff() },
  "handoff-other": { group: "Code", note: "Phone from the QR, another PayPal account", render: () => handoff("Sam Doe") },
  code: { group: "Code", note: "Code, timer and the phone's QR", render: () => flow({ preview: { phase: "code" } }) },
  "code-low": {
    group: "Code",
    note: "Under a minute left",
    render: () => flow({ preview: { phase: "code" } }, { ...fx.open, captureSession: { id: "cs_preview", expiresAt: new Date(fx.NOW + 42_000).toISOString() } }),
  },
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
  capture: { group: "Camera", note: "Live, no shots yet (the AC state)", render: () => flow({ preview: { phase: "capture", capture: { camera: "live", still: "/demo/c02-1.jpg" } } }) },
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
  "demo-capture-wrong-code": { group: "Camera", note: "Demo: the wrong code, its tag reading another", render: () => flow({ sample: wrongCode, preview: { phase: "capture" } }, { ...fx.open, code: "K7P" }) },
  "demo-capture-ai": { group: "Camera", note: "Demo: the uploaded photo, sent from outside", render: () => flow({ sample: demoSample("ai-no-session"), preview: { phase: "capture" } }, { ...fx.open, code: "H6W" }) },
  checking: { group: "Checking", note: "Photo 1 read by the model, 18 s in", render: () => flow({ preview: { phase: "checking", checking: { elapsed: 18 }, photoUrls: fx.paid.photoUrls } }, fx.checkingModel) },
  "checking-model": { group: "Checking", note: "Pre-checks passed, model running (6 s)", render: () => flow({ preview: { phase: "checking", checking: { elapsed: 6 }, photoUrls: fx.paid.photoUrls } }, fx.checkingModel) },
  "checking-slow": { group: "Checking", note: "Past 40 s: taking longer than usual", render: () => flow({ preview: { phase: "checking", checking: { elapsed: 47 }, photoUrls: fx.paid.photoUrls } }, fx.checkingModel) },
  "checking-offline": { group: "Checking", note: "Polling lost the connection", render: () => flow({ preview: { phase: "checking", checking: { elapsed: 21, offline: true }, photoUrls: fx.paid.photoUrls } }, fx.checkingModel) },
  "checking-done": { group: "Checking", note: "All checks resolved: quotes and green code cells", render: () => flow({ preview: { phase: "checking", checking: { elapsed: 19 }, photoUrls: fx.paid.photoUrls } }, fx.paid.claim) },
  "checking-blocked": { group: "Checking", note: "Stopped by a pre-check", render: () => flow({ preview: { phase: "checking", checking: { elapsed: 1 }, photoUrls: fx.blocked.photoUrls } }, fx.blocked.claim) },
  "demo-checking": {
    group: "Checking",
    note: "Demo: the sample being read",
    render: () => flow({ sample: genuine, preview: { phase: "checking", checking: { elapsed: 12 }, photoUrls: genuine.photos } }, { ...fx.checkingModel, code: "M4T", demo: true }),
  },
  paid: { group: "Result", note: "Paid, payout processing", render: () => result(fx.paid, { payout: { status: "PENDING", fresh: true }, account: "p••@owner.test" }) },
  "paid-arrive": { group: "Result", note: "Paid just now: the receipt prints", render: () => result(fx.paid, { payout: { status: "PENDING", fresh: true }, now: fx.NOW + 24_000 }) },
  "paid-settled": { group: "Result", note: "Paid, payout received", render: () => result(fx.paid, { payout: { status: "SUCCESS", fresh: true } }) },
  "paid-received": { group: "Result", note: "Paid, payout received (old name)", render: () => result(fx.paid, { payout: { status: "SUCCESS", fresh: true } }) },
  "paid-partial": { group: "Result", note: "Paid, PayPal status unreachable", render: () => result(fx.paid, { payout: { status: "PENDING", fresh: false } }) },
  held: { group: "Result", note: "Held: unclear answers", render: () => result(fx.held) },
  "held-model": { group: "Result", note: "Held: the model was down", render: () => result(fx.heldModel) },
  "held-limit": { group: "Result", note: "Held: the daily photo-check limit was reached", render: () => result(fx.heldLimit) },
  "held-payout": { group: "Result", note: "Held: PayPal refused the payout", render: () => result(fx.heldPayout) },
  rejected: { group: "Result", note: "Rejected: wrong code (the code diff), uncertain read: ask a person", render: () => result(fx.rejected) },
  "review-asked": { group: "Result", note: "Held: the owner asked a person to look", render: () => result(fx.reviewAsked) },
  "rejected-screen": { group: "Result", note: "Rejected: photo of a screen", render: () => result(fx.rejectedScreen) },
  blocked: { group: "Result", note: "Blocked: outside the camera session", render: () => result(fx.blocked) },
  "blocked-duplicate": { group: "Result", note: "Blocked: another account's photo, reposted", render: () => result(fx.blockedDuplicate) },
  "blocked-account": {
    group: "Result",
    note: "Blocked: repost from a paid account, its earlier claim beside it",
    render: () => result(fx.blockedAccount, { duplicate: { photo: 1, earlier: { id: "RM-0412", n: 1, src: "/demo/c02-1.jpg" } } }),
  },
  "demo-paid": {
    group: "Result",
    note: "Demo: genuine sample paid, next sample",
    render: () => result(fx.paid, { sample: genuine, payout: { status: "PENDING", fresh: true }, round: fx.roundAfter(["genuine"]) }),
  },
  "demo-rejected": {
    group: "Result",
    note: "Demo: the wrong code, rejected",
    render: () => result(fx.demoWrongCode, { sample: wrongCode, round: fx.roundAfter(["genuine", "wrong-code"]) }),
  },
  "demo-unanswered": {
    group: "Result",
    note: "Demo: the model didn't answer, run it again",
    render: () => result(fx.heldModel, { sample: genuine, round: { runs: [{ sample: "genuine", decision: "held", unanswered: true }] } }),
  },
  "demo-blocked": { group: "Result", note: "Demo: uploaded photo refused", render: () => result(fx.blocked, { sample: demoSample("ai-no-session"), round: fx.roundAfter(["genuine", "wrong-code", "ai-no-session"]) }) },
  "demo-done": {
    group: "Result",
    note: "Demo: the repost, all four run",
    render: () =>
      result(fx.blockedDuplicate, {
        sample: reposted,
        round: fx.roundAfter(["genuine", "wrong-code", "ai-no-session", "reposted"]),
        duplicate: { photo: 1, earlier: { id: "RM-0412", n: 1, src: reposted.photos[0] } },
      }),
  },
  loading: { group: "States", note: "Loading skeleton: a step", render: () => <FlowSkeleton /> },
  "loading-recall": { group: "States", note: "Loading skeleton: the recall screen", render: () => <FlowSkeleton wide /> },
  "not-found": { group: "States", note: "Unknown link", render: () => <FlowShell bare><NotFoundCard /></FlowShell> },
  error: {
    group: "States",
    note: "Page failed to render",
    render: () => (
      <FlowShell>
        <ClaimErrorCard recall="kikea-x-vesolje" id="RM-0412" />
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
      <h1 className="text-h2 font-medium">Claim flow previews</h1>
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
