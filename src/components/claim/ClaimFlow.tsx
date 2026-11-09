"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import type { DemoSample } from "@/lib/demo";
import type { CheckSpec } from "@/lib/types";
import { CaptureStep, type CapturePreview } from "./CaptureStep";
import { CheckingStep } from "./CheckingStep";
import { CodeStep } from "./CodeStep";
import { DemoCaptureStep } from "./DemoCaptureStep";
import { ClaimFrame } from "./Exhibit";
import { firstShown, focusInView } from "./FocusTitle";
import { cutInHalf, handWrittenLabel, taggedThing, type ClaimView } from "./model";
import { useClaimArrival } from "./useClaimArrival";

export type Phase = "code" | "capture" | "checking";

export interface ClaimFlowProps {
  /** The recall's slug: the checking screen asks for the result by it. */
  slug: string;
  claimId: string;
  code: string;
  /** The capture session the photos must arrive with; real claims only. */
  sessionId: string;
  expiresAt: string;
  /** Server clock at render, for the countdown's first paint. */
  startNow: number;
  spec: CheckSpec;
  /** The refund, for the refund row under the checks. */
  refund: { value: string; currency: string };
  view: ClaimView;
  qrSvg: string;
  phoneUrl: string;
  newClaimHref: string;
  loginHref: string;
  /** "Kikea Store": the checking screen's held headline. */
  company?: string;
  sample?: DemoSample | null;
  /** Dev previews: start at a phase, with the camera or checks pinned. */
  preview?: { phase: Phase; capture?: CapturePreview; checking?: { elapsed?: number; offline?: boolean; animate?: boolean; next?: string }; sending?: boolean; photoUrls?: string[] };
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
  // One name for the thing the code goes on, everywhere: a hand-written label is written on the paper tag with the code,
  // so it is "your paper tag" (never the product's own sewn-in tag), and the line names both things written on it.
  const written = handWrittenLabel(props.spec);
  const done = cutInHalf(props.spec) ? "cut in half" : "destroyed";
  // What the photo needs, in one line under the frame.
  const reminder = written
    ? `Photograph your paper tag with ${written} and ${code} beside the ${taggedThing(props.spec)?.replace(/^(cut|destroyed) /, "") || "product"} ${done}.`
    : `Photograph the code ${code} beside the label, and the product ${done}.`;
  const framing = { thing: written ? "paper tag" : "label", product: (written && taggedThing(props.spec)) || `${cutInHalf(props.spec) ? "cut" : "destroyed"} product` };

  // On arrival too: the first step loads by a full navigation (a form post, a redirect), which leaves focus on the body.
  useEffect(() => {
    const ids = phase !== "capture" ? [TITLE[phase]] : demo ? ["sample-title", "sample-title-wide"] : ["capture-title", "capture-title-wide", "camera-message"];
    focusInView(firstShown(...ids));
  }, [phase, demo]);

  // Local photo URLs are freed when the flow goes away (the result replaces it).
  useEffect(() => () => photoUrls?.forEach((u) => u.startsWith("blob:") && URL.revokeObjectURL(u)), [photoUrls]);

  const go = (next: Phase) => {
    setPhase(next);
    window.scrollTo({ top: 0 });
  };
  const sent = (next: ClaimView | null, urls?: string[]) => {
    const apply = () => {
      if (next) setView(next);
      if (urls?.length) setPhotoUrls(urls);
      go("checking");
    };
    // From the camera, the photo just taken carries into the checking screen (a View Transition: the still and the
    // checking screen's photo share a name, PHOTO_TRANSITION) while the camera's dark gives way to the page, so the
    // object never leaves the eye. Without the API, under reduced motion (a crossfade would lay the camera over the
    // checks), or for photos that came from another device, it simply swaps.
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (phase === "capture" && !still && typeof document.startViewTransition === "function" && document.visibilityState === "visible") {
      document.startViewTransition(() => flushSync(apply));
      return;
    }
    apply();
  };
  // The code step on a laptop while the phone takes the photos (the QR handoff): on to checking once they arrive. The
  // camera step polls for itself, since it knows when this tab is sending.
  useClaimArrival(claimId, props.expiresAt, (next) => sent(next), { off: demo || Boolean(preview) || phase !== "code" });

  return (
    <ClaimFrame>
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
          <DemoCaptureStep claimId={claimId} code={code} sample={sample} onSent={sent} backHref={props.newClaimHref} written={written} preview={preview && { sending: preview.sending }} />
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
            written={written}
            framing={framing}
            onSent={sent}
            onBack={() => go("code")}
            preview={preview?.capture}
          />
        ))}
      {phase === "checking" && (
        <CheckingStep
          slug={props.slug}
          claimId={claimId}
          view={view}
          spec={props.spec}
          refund={props.refund}
          startNow={props.startNow}
          photoUrls={photoUrls}
          sending={preview?.sending}
          company={props.company}
          preview={preview?.checking ?? (preview ? {} : undefined)}
        />
      )}
    </ClaimFrame>
  );
}
