"use client";

import { useState } from "react";
import type { DemoSample } from "@/lib/demo";
import type { CheckSpec } from "@/lib/types";
import { CaptureStep, type CapturePreview } from "./CaptureStep";
import { CheckingStep } from "./CheckingStep";
import { CodeStep } from "./CodeStep";
import { DemoCaptureStep } from "./DemoCaptureStep";
import type { ClaimView } from "./model";
import { DEMO_STEPS, REAL_STEPS, StepMeter } from "./StepMeter";

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
  preview?: { phase: Phase; capture?: CapturePreview; checking?: { elapsed?: number; offline?: boolean }; sending?: boolean };
}

/** Code, camera, checking: the steps of an open claim, in the browser. The result is rendered by the server. */
export function ClaimFlow(props: ClaimFlowProps) {
  const { claimId, code, view: initial, sample, preview } = props;
  const [phase, setPhase] = useState<Phase>(preview?.phase ?? (initial.photos > 0 ? "checking" : "code"));
  const [view, setView] = useState(initial);
  const demo = Boolean(sample);
  const steps = demo ? DEMO_STEPS : REAL_STEPS;
  const current = phase === "checking" ? 4 : demo ? 3 : phase === "code" ? 2 : 3;

  const go = (next: Phase) => {
    setPhase(next);
    window.scrollTo({ top: 0 });
  };
  const sent = (next: ClaimView | null) => {
    if (next) setView(next);
    go("checking");
  };

  return (
    <div className="flex flex-col gap-6">
      <StepMeter current={current} steps={steps} />
      {phase === "code" && (
        <CodeStep code={code} spec={props.spec} expiresAt={props.expiresAt} startNow={props.startNow} frozen={Boolean(preview)} sample={sample} onContinue={() => go("capture")} />
      )}
      {phase === "capture" &&
        (sample ? (
          <DemoCaptureStep claimId={claimId} code={code} sample={sample} onSent={sent} preview={preview && { sending: preview.sending }} />
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
            onSent={sent}
            preview={preview?.capture}
          />
        ))}
      {phase === "checking" && <CheckingStep claimId={claimId} view={view} sending={preview?.sending} preview={preview?.checking ?? (preview ? {} : undefined)} />}
    </div>
  );
}
