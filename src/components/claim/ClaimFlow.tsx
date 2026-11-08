"use client";

import { useCallback, useEffect, useState } from "react";
import type { DemoSample } from "@/lib/demo";
import type { CheckSpec } from "@/lib/types";
import { CaptureStep, type CapturePreview } from "./CaptureStep";
import { CheckingStep } from "./CheckingStep";
import { CodeStep } from "./CodeStep";
import { DemoCaptureStep } from "./DemoCaptureStep";
import { ClaimFrame } from "./Exhibit";
import { focusInView } from "./FocusTitle";
import { cutInHalf, handWrittenLabel, taggedThing, type ClaimView } from "./model";
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
  /** The refund, "$29.99", for the checks' last row. */
  amount: string;
  view: ClaimView;
  qrSvg: string;
  phoneUrl: string;
  newClaimHref: string;
  loginHref: string;
  /** "Kikea Store": the checking screen's held headline. */
  company?: string;
  sample?: DemoSample | null;
  /** Dev previews: start at a phase, with the camera or checks pinned. */
  preview?: { phase: Phase; capture?: CapturePreview; checking?: { elapsed?: number; offline?: boolean }; sending?: boolean; photoUrls?: string[] };
}

// Each phase's h2: focus moves there on arrival and on every step change, so a keyboard or screen reader lands on the new step.
const TITLE: Record<Phase, string> = { code: "code-title", capture: "capture-title", checking: "checking-title" };

/**
 * Code, camera, checking: the steps of an open claim, in the browser. The result is rendered by the server. A demo claim
 * opens on its sample's photo: the tag is already written, so there is no code to write and no timer to beat; the photo
 * step names the code.
 */
export function ClaimFlow(props: ClaimFlowProps) {
  const { claimId, code, view: initial, sample, preview } = props;
  const [phase, setPhase] = useState<Phase>(preview?.phase ?? (initial.photos > 0 ? "checking" : sample ? "capture" : "code"));
  const [view, setView] = useState(initial);
  // The checking screen's photos: the ones just sent (local object URLs, or the sample's public files).
  const [photoUrls, setPhotoUrls] = useState<string[] | undefined>(preview?.photoUrls ?? (initial.photos > 0 && sample ? sample.photos : undefined));
  const demo = Boolean(sample);
  const steps = demo ? DEMO_STEPS : REAL_STEPS;
  // The checks are part of the photo step: the meter reaches the refund only once every row has landed.
  const [settled, setSettled] = useState(false);
  const onSettled = useCallback(() => setSettled(true), []);
  const current = phase === "checking" ? (settled ? 4 : 3) : demo ? 3 : phase === "code" ? 2 : 3;
  // One word for the thing the code goes on, everywhere: a hand-written label is the paper tag itself.
  const tag = handWrittenLabel(props.spec) !== null;
  // What the photo needs, in one line under the frame.
  const reminder = `${tag ? "Tag" : "Label"} with ${code}, and the ${(tag && taggedThing(props.spec)?.replace(/^cut /, "")) || "product"} ${cutInHalf(props.spec) ? "cut in half" : "destroyed"}.`;
  const framing = { thing: tag ? "tag" : "label", product: (tag && taggedThing(props.spec)) || `${cutInHalf(props.spec) ? "cut" : "destroyed"} product` };

  // On arrival too: the first step loads by a full navigation (a form post, a redirect), which leaves focus on the body.
  useEffect(() => {
    focusInView(document.getElementById(phase === "capture" && demo ? "sample-title" : TITLE[phase]));
  }, [phase, demo]);

  // Local photo URLs are freed when the flow goes away (the result replaces it).
  useEffect(() => () => photoUrls?.forEach((u) => u.startsWith("blob:") && URL.revokeObjectURL(u)), [photoUrls]);

  const go = (next: Phase) => {
    setPhase(next);
    window.scrollTo({ top: 0 });
  };
  const sent = (next: ClaimView | null, urls?: string[]) => {
    if (next) setView(next);
    if (urls?.length) setPhotoUrls(urls);
    go("checking");
  };
  // The code step on a laptop while the phone takes the photos (the QR handoff): on to checking once they arrive. The
  // camera step polls for itself, since it knows when this tab is sending.
  useClaimArrival(claimId, props.expiresAt, (next) => sent(next), { off: demo || Boolean(preview) || phase !== "code" });

  return (
    <ClaimFrame>
      <StepMeter current={current} steps={steps} compact={phase === "capture"} />
      {phase === "code" && (
        <div className="w-full">
          <CodeStep
            claimId={claimId}
            code={code}
            spec={props.spec}
            expiresAt={props.expiresAt}
            startNow={props.startNow}
            frozen={Boolean(preview)}
            qrSvg={props.qrSvg}
            phoneUrl={props.phoneUrl}
            newClaimHref={props.newClaimHref}
            onContinue={() => go("capture")}
          />
        </div>
      )}
      {phase === "capture" &&
        (sample ? (
          <DemoCaptureStep claimId={claimId} code={code} sample={sample} onSent={sent} backHref={props.newClaimHref} preview={preview && { sending: preview.sending }} />
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
            reminder={reminder}
            framing={framing}
            onSent={sent}
            onBack={() => go("code")}
            preview={preview?.capture}
          />
        ))}
      {phase === "checking" && (
        <CheckingStep
          claimId={claimId}
          view={view}
          spec={props.spec}
          amount={props.amount}
          startNow={props.startNow}
          photoUrls={photoUrls}
          sending={preview?.sending}
          company={props.company}
          onSettled={onSettled}
          preview={preview?.checking ?? (preview ? {} : undefined)}
        />
      )}
    </ClaimFrame>
  );
}
