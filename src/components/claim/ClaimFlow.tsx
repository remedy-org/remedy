"use client";

import { useEffect, useRef, useState } from "react";
import type { DemoSample } from "@/lib/demo";
import type { CheckSpec } from "@/lib/types";
import { CaptureStep, type CapturePreview } from "./CaptureStep";
import { CheckingStep } from "./CheckingStep";
import { CodeStep } from "./CodeStep";
import { DemoCaptureStep } from "./DemoCaptureStep";
import { WithJudges, type JudgeStep } from "./Judges";
import { cutInHalf, type ClaimView } from "./model";
import { DEMO_STEPS, REAL_STEPS, StepMeter } from "./StepMeter";
import { useClaimArrival } from "./useClaimArrival";

export type Phase = "code" | "capture" | "checking";

export interface ClaimFlowProps {
  claimId: string;
  code: string;
  /** The capture session the photos must arrive with; real claims only. */
  sessionId: string;
  expiresAt: string;
  /** Server clock at render, for the countdown's first paint. */
  startNow: number;
  spec: CheckSpec;
  view: ClaimView;
  qrSvg: string;
  phoneUrl: string;
  newClaimHref: string;
  loginHref: string;
  sample?: DemoSample | null;
  /** Dev previews: start at a phase, with the camera or checks pinned. */
  preview?: { phase: Phase; capture?: CapturePreview; checking?: { elapsed?: number; offline?: boolean }; sending?: boolean; photoUrl?: string };
}

// Each phase's h2: focus moves there on every step change, so a keyboard or screen reader lands on the new step.
const TITLE: Record<Phase, string> = { code: "code-title", capture: "capture-title", checking: "checking-title" };
const JUDGE: Record<Phase, JudgeStep> = { code: "code", capture: "capture", checking: "checking" };

/**
 * Code, camera, checking: the steps of an open claim, in the browser. The result is rendered by the server. A demo claim
 * opens on its sample's photo: the tag is already written, so there is no code to write and no timer to beat; the photo
 * step names the code.
 */
export function ClaimFlow(props: ClaimFlowProps) {
  const { claimId, code, view: initial, sample, preview } = props;
  const [phase, setPhase] = useState<Phase>(preview?.phase ?? (initial.photos > 0 ? "checking" : sample ? "capture" : "code"));
  const [view, setView] = useState(initial);
  // Photo 1 on the checking screen: the photo just sent (a local object URL, or the sample's public file).
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(preview?.photoUrl ?? (initial.photos > 0 && sample ? sample.photos[0] : undefined));
  const demo = Boolean(sample);
  const steps = demo ? DEMO_STEPS : REAL_STEPS;
  const current = phase === "checking" ? 4 : demo ? 3 : phase === "code" ? 2 : 3;
  const reminders = ["Label", cutInHalf(props.spec) ? "Cut in half" : "Destroyed", `Code ${code}`];

  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) return;
    document.getElementById(phase === "capture" && demo ? "sample-title" : TITLE[phase])?.focus({ preventScroll: true });
  }, [phase, demo]);

  // A local photo URL is freed when the flow goes away (the result replaces it).
  useEffect(() => () => void (photoUrl?.startsWith("blob:") && URL.revokeObjectURL(photoUrl)), [photoUrl]);

  const go = (next: Phase) => {
    moved.current = true;
    setPhase(next);
    window.scrollTo({ top: 0 });
  };
  const sent = (next: ClaimView | null, url?: string) => {
    if (next) setView(next);
    if (url) setPhotoUrl(url);
    go("checking");
  };
  // The code step on a laptop while the phone takes the photos (the QR handoff): on to checking once they arrive. The
  // camera step polls for itself, since it knows when this tab is sending.
  useClaimArrival(claimId, props.expiresAt, (next) => sent(next), { off: demo || Boolean(preview) || phase !== "code" });

  return (
    <WithJudges demo={demo} step={JUDGE[phase]}>
      <div className="flex flex-col gap-6">
        <StepMeter current={current} steps={steps} compact={phase === "capture"} />
        {phase === "code" && (
          <div className="mx-auto w-full max-w-claim lg:max-w-[55rem]">
            <CodeStep
              code={code}
              spec={props.spec}
              expiresAt={props.expiresAt}
              startNow={props.startNow}
              frozen={Boolean(preview)}
              qrSvg={props.qrSvg}
              phoneUrl={props.phoneUrl}
              onContinue={() => go("capture")}
            />
          </div>
        )}
        {phase === "capture" &&
          (sample ? (
            <DemoCaptureStep claimId={claimId} code={code} sample={sample} reminders={reminders} onSent={sent} preview={preview && { sending: preview.sending }} />
          ) : (
            <CaptureStep
              claimId={claimId}
              sessionId={props.sessionId}
              code={code}
              expiresAt={props.expiresAt}
              startNow={props.startNow}
              qrSvg={props.qrSvg}
              phoneUrl={props.phoneUrl}
              newClaimHref={props.newClaimHref}
              loginHref={props.loginHref}
              reminders={reminders}
              onSent={sent}
              preview={preview?.capture}
            />
          ))}
        {phase === "checking" && (
          <CheckingStep
            claimId={claimId}
            view={view}
            startNow={props.startNow}
            photoUrl={photoUrl}
            sample={demo}
            sending={preview?.sending}
            preview={preview?.checking ?? (preview ? {} : undefined)}
          />
        )}
      </div>
    </WithJudges>
  );
}
