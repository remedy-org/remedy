"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { ArrowLeftIcon, Button } from "@/components/ui";
import type { DemoSample } from "@/lib/demo";
import { SAMPLE_COPY, sampleTitle } from "@/lib/demo/sampleCopy";
import { rememberAspect } from "./ClaimPhotos";
import { CodeTag } from "./CodeTag";
import { checkDemoPhotoReceipt, DEMO_SEND_WAIT_MS, sendDemoPhoto } from "./demoPhotoRequest";
import { PHOTO_TRANSITION, photoWidth } from "./Exhibit";
import styles from "./flow.module.css";
import { MobileCta } from "./MobileCta";
import type { ClaimView } from "./model";
import { Notice } from "./Notice";
import { CAMERA_BACK, CAMERA_FRAME, CameraTopBar, Cutout, Dock, InstructionBar } from "./Viewfinder";

export interface DemoCaptureStepProps {
  claimId: string;
  code: string;
  sample: DemoSample;
  onSent(view: ClaimView | null, photoUrls?: string[]): void;
  /** The claim picker: the camera's top bar leads back to it below 1024px. */
  backHref: string;
  /** The label hand-written on the tag beside the code, for the tag beside the camera on a laptop. */
  written?: string | null;
  preview?: { sending?: boolean; sendError?: string };
}

// The demo photos are 2:3 portrait: drawn at that shape here, so the checking screen shows them at the same size.
const ASPECT = 2 / 3;
// Long enough for the photo to drop into its slot before the checks take over the screen.
const DROP_MS = 480;
const IMAGE_WAIT_MS = 12_000;
const DEMO_DISCLOSURE = "Prepared demo photo. Submit it to run this claim’s checks.";
// From 640px to 1024px the camera card hugs its photo (as wide as photoWidth draws it, plus the dock's room), so it
// isn't a wide black box around a narrow strip; from 1024px it is the photo's own width (never narrower than the dock
// needs), on the column's left edge, so the photo is where the checking screen keeps it. Spelled out so Tailwind finds it.
const HUG =
  "sm:max-lg:mx-auto sm:max-lg:w-[min(100%,calc(min(55svh,100svh_-_18rem)*2/3_+_10rem))] lg:w-[max(16rem,min(100%,calc(min(55svh,100svh_-_18rem)*2/3)))]";

/**
 * A demo claim's photo step. A claim photographed in the claim's camera shows in the live camera's own chrome: the
 * photo in the viewfinder with the guide, and the round shutter, which flashes; the photo drops into the tray and the
 * checks begin. A picture pulled from the web wasn't taken in any camera of ours, so it shows as what it is, a flat
 * picture with a plain "Send this picture". The server sends its own copy of the photo; nothing about the checks changes.
 */
export function DemoCaptureStep({ claimId, code, sample, onSent, backHref, written, preview }: DemoCaptureStepProps) {
  const [state, setState] = useState<"idle" | "sending" | "slow" | "uncertain" | "retry">(preview?.sending ? "sending" : preview?.sendError ? "retry" : "idle");
  const [error, setError] = useState<string | null>(preview?.sendError ?? null);
  const [checking, setChecking] = useState(false);
  const [flash, setFlash] = useState(false);
  const [imageState, setImageState] = useState<"loading" | "slow" | "ready" | "error">("loading");
  const [imageAttempt, setImageAttempt] = useState(0);
  const image = useRef<HTMLImageElement>(null);
  const photoSrc = imageAttempt ? `${sample.photos[0]}?reload=${imageAttempt}` : sample.photos[0];
  useEffect(() => {
    if (imageState !== "loading") return;
    if (image.current?.complete) {
      setImageState(image.current.naturalWidth ? "ready" : "error");
      return;
    }
    const timer = setTimeout(() => setImageState("slow"), IMAGE_WAIT_MS);
    return () => clearTimeout(timer);
  }, [photoSrc, imageState]);
  // State updates render later: a synchronous guard also blocks double clicks and Space + click in the same frame.
  const locked = useRef(Boolean(preview?.sending));
  const sendAttempt = useRef(0);
  const checkingRef = useRef(false);
  const finished = useRef(false);
  const mounted = useRef(true);
  const waitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(waitTimer.current);
    };
  }, []);
  const title = sampleTitle(sample.id, sample.title);
  const upload = !sample.liveSession;
  const sending = state === "sending" || state === "slow" || state === "uncertain";

  function received(view: ClaimView | null) {
    if (!mounted.current || finished.current) return;
    finished.current = true;
    clearTimeout(waitTimer.current);
    onSent(view, sample.photos);
  }

  async function send() {
    // The shutter stays focusable while the photo goes (aria-disabled, never disabled), so focus never drops to the page
    // before the checking screen's heading takes it: a second press just does nothing.
    if (locked.current || finished.current || imageState !== "ready") return;
    locked.current = true;
    sendAttempt.current++;
    setState("sending");
    setError(null);
    // This is a waiting threshold, not cancellation: the server may still receive the photo and answer later.
    waitTimer.current = setTimeout(() => {
      if (mounted.current && !finished.current) setState("slow");
    }, DEMO_SEND_WAIT_MS);
    // The shutter's flash is motion: a reduced-motion setting skips it rather than popping it.
    if (!upload && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setFlash(true);
      setTimeout(() => setFlash(false), 40);
    }
    rememberAspect(claimId, 1, ASPECT, 1);
    const [result] = await Promise.all([sendDemoPhoto(claimId), new Promise((r) => setTimeout(r, upload ? 0 : DROP_MS))]);
    if (!mounted.current || finished.current) return;
    clearTimeout(waitTimer.current);
    if (result.kind === "received") return received(result.view);
    setError(result.message);
    setState(result.kind);
    // Network errors and server errors cannot tell us whether the write happened. Never unlock those for a resend.
    if (result.kind === "retry") locked.current = false;
  }

  async function checkReceipt() {
    if (checkingRef.current || finished.current) return;
    const attempt = sendAttempt.current;
    checkingRef.current = true;
    setChecking(true);
    const result = await checkDemoPhotoReceipt(claimId);
    checkingRef.current = false;
    if (!mounted.current || finished.current) return;
    setChecking(false);
    if (result.kind === "received") return received(null);
    // A reply to the POST may have arrived while this read was pending. Do not overwrite a known rejection or a
    // newer send with an old status response.
    if (!locked.current || attempt !== sendAttempt.current) return;
    clearTimeout(waitTimer.current);
    setState("uncertain");
    setError(result.message);
  }

  // Laptops: the space bar is the shutter, as in the live camera, unless focus is on something space already presses.
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  });
  useEffect(() => {
    if (upload) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || e.defaultPrevented) return;
      if (e.target instanceof Element && e.target.closest("button, a, input, textarea, select, summary, dialog, [contenteditable]")) return;
      e.preventDefault();
      void sendRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [upload]);

  // The owner's situation in one line: what is in the photo, never what the checks will make of it.
  const line = SAMPLE_COPY[sample.id]?.line ?? sample.description;
  const reloadPhoto = () => {
    setImageState("loading");
    setImageAttempt((n) => n + 1);
  };
  const status = state === "idle" ? (imageState !== "ready" && (
    <div className="flex w-full flex-col items-start gap-3">
      <Notice title={imageState === "error" ? "The sample photo didn’t load" : imageState === "slow" ? "The photo is taking longer to load" : "Loading sample photo…"} tone={imageState === "error" ? "stop" : "neutral"} role={imageState === "error" ? "alert" : "status"}>
        {imageState === "error" || imageState === "slow" ? "Reload the photo to continue with this same claim and code." : "The photo needs to load before you can send it."}
      </Notice>
      {(imageState === "error" || imageState === "slow") && <Button variant="secondary" onClick={reloadPhoto}>Reload photo</Button>}
    </div>
  )) : (
    <div className="flex w-full flex-col items-start gap-3">
      <Notice
        title={state === "sending" ? (upload ? "Sending picture…" : "Sending photo…") : state === "slow" ? "Still waiting for a reply" : state === "retry" ? "The photo wasn’t accepted" : "Receipt not confirmed"}
        tone={state === "retry" ? "stop" : "neutral"}
        role={state === "retry" ? "alert" : "status"}
      >
        {error ?? (state === "sending" ? "Keep this claim open while we confirm the photo arrived." : "The send may still be running. Your photo stays with this claim; check whether it arrived.")}
      </Notice>
      {(state === "slow" || state === "uncertain") && (
        <Button variant="secondary" onClick={checkReceipt} aria-disabled={checking || undefined} aria-busy={checking || undefined}>
          {checking ? "Checking this claim…" : "Check this claim"}
        </Button>
      )}
      {state === "retry" && !upload && <Button onClick={send}>Try sending again</Button>}
    </div>
  );
  const back = (
    <a href={backHref} className={CAMERA_BACK}>
      <ArrowLeftIcon className="shrink-0" /> All four claims
    </a>
  );

  return (
    <section aria-label={title} className="grid w-full max-w-[40rem] items-start gap-5 lg:max-w-none lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-6">
      {/* A laptop's right column, first in the page's order (the photo is placed in the left column), so Tab from the
          title goes on to the shutter. */}
      <div className="hidden flex-col gap-6 lg:col-start-2 lg:row-start-1 lg:flex">
        <div className="flex flex-col gap-3">
          <h1 id="sample-title-wide" tabIndex={-1} className="font-display text-title font-semibold text-balance text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-4">
            {title}
          </h1>
          <p className="text-body text-pretty text-muted">{line}</p>
          <p className="text-ui text-pretty text-muted">{DEMO_DISCLOSURE}</p>
        </div>
        {!upload && status}
        {/* This claim's code, as the owner would have written it: the tag in the photo is checked against it. */}
        <figure className="flex flex-col gap-3">
          <CodeTag code={code} written={written} />
          <figcaption className="text-ui text-muted">
            {upload ? "Your one-time code. A photo counts only if it arrives inside this claim’s 10-minute camera session." : "Your one-time code. This photo’s tag is already written. Press the shutter to send it."}
          </figcaption>
        </figure>
      </div>
      {upload ? (
        // A picture from the web: no viewfinder, no shutter. The picture on its own, and the button that sends it.
        <div className="flex flex-col gap-5 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <a href={backHref} className="inline-flex min-h-11 items-center gap-1.5 self-start text-ui text-muted hover:text-text lg:hidden">
            <ArrowLeftIcon className="shrink-0" /> All four claims
          </a>
          <div className="flex flex-col gap-1 lg:hidden">
            <h1 id="sample-title" tabIndex={-1} className="font-display text-title font-semibold text-balance text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-4">
              {title}
            </h1>
            <p className="text-body text-pretty text-muted">{line}</p>
            <p className="text-ui text-pretty text-muted">{DEMO_DISCLOSURE}</p>
          </div>
          {/* Phones: the code this claim was issued, which the result's tag check names (a laptop has the tag beside it). */}
          <p className="text-ui text-pretty text-muted lg:hidden">
            Your one-time code is <span className="font-mono whitespace-nowrap text-text">{code}</span>. A photo counts only if it arrives inside this claim&rsquo;s 10-minute camera session.
          </p>
          {/* A phone: the picture and its button on the text's own width, the picture no taller than leaves the button on
              the first screen. A laptop: the picture at the camera's size, and the button as wide as it. */}
          <figure className="flex flex-col gap-2 lg:w-(--photo-w)" style={{ ["--photo-w" as string]: photoWidth(ASPECT) }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={image}
              src={photoSrc}
              onLoad={() => setImageState("ready")}
              onError={() => setImageState("error")}
              alt={`The picture: ${title.toLowerCase()}`}
              style={{ viewTransitionName: PHOTO_TRANSITION }}
              className="block aspect-[2/3] h-auto w-full rounded-card bg-surface-2 object-cover object-[50%_62%] ring-1 ring-line max-lg:max-h-[44svh]"
            />
            <figcaption className="text-ui text-muted">A picture file, not a photo from this claim&rsquo;s camera</figcaption>
          </figure>
          <div className="w-full lg:w-[max(16rem,var(--photo-w))]" style={{ ["--photo-w" as string]: photoWidth(ASPECT) }}>
            {/* Busy, not disabled: focus stays on it until the checking screen's heading takes it. */}
            <Button id="send-picture" onClick={send} aria-disabled={sending || imageState !== "ready" || undefined} aria-busy={state === "sending" || state === "slow" || undefined} data-pending={sending ? "" : undefined} size="lg" block>
              {state === "uncertain" ? "Receipt not confirmed" : sending ? "Sending picture…" : state === "retry" ? "Try sending again" : "Send this picture"}
            </Button>
          </div>
          {status}
          <MobileCta target="send-picture" label={state === "uncertain" ? "Receipt not confirmed" : sending ? "Sending picture…" : "Send this picture"} onClick={send} disabled={sending || imageState !== "ready"} />
        </div>
      ) : (
        <div data-theme="dark" data-camera="" className={clsx(CAMERA_FRAME, HUG, "lg:col-start-1 lg:row-span-2 lg:row-start-1")}>
          <CameraTopBar back={back}>
            {/* Said, not left bare: "Code" in the bar's muted sans, the code itself in mono. */}
            <span className="text-[oklch(0.86_0.005_80)]">
              Code <span className="font-mono text-[oklch(0.96_0.006_85)]">{code}</span>
            </span>
          </CameraTopBar>
          {/* The photo whole at its own shape (the tag is what the checks read), at the size the checking screen keeps. The
              code is the bar's (and the tag's beside it on a laptop), so the frame carries only the guide. */}
          <div className="relative flex min-h-0 justify-center overflow-hidden max-sm:items-center">
            <figure className="relative" style={{ aspectRatio: ASPECT, width: photoWidth(ASPECT) }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img ref={image} src={photoSrc} onLoad={() => setImageState("ready")} onError={() => setImageState("error")} alt={SAMPLE_COPY[sample.id]?.alt ?? `Photo: ${title.toLowerCase()}`} style={{ viewTransitionName: PHOTO_TRANSITION }} className="absolute inset-0 size-full object-contain" />
              {/* A photo already taken: the guide frames all of it, so it never cuts across the tag. */}
              <Cutout inset="inset-x-[3%] inset-y-[2%]" />
              <div aria-hidden="true" className={clsx("pointer-events-none absolute inset-0 bg-[oklch(1_0_0)]", flash ? clsx("opacity-50", styles.flashOn) : clsx("opacity-0", styles.flashOff))} />
            </figure>
          </div>
          {/* Below 1024px: what the photo is, under the frame. A laptop has it in the right column. */}
          <InstructionBar className="flex-col items-start gap-1 px-5 py-3 text-left lg:hidden">
            <h1 id="sample-title" tabIndex={-1} className="text-ui font-medium text-balance text-[oklch(0.96_0.006_85)] outline-none focus-visible:outline-2 focus-visible:outline-offset-4">
              {title}
            </h1>
            <p className="text-ui text-[oklch(0.86_0.005_80)]">{DEMO_DISCLOSURE}</p>
            {/* A short window (a laptop at 200%) keeps the title alone, so the shutter stays on the first screen. */}
            {status || <p className="text-ui text-[oklch(0.86_0.005_80)] [@media(max-height:600px)]:hidden">{line}</p>}
          </InstructionBar>
          <Dock
            short
            className="border-t border-[oklch(1_0_0/0.08)]"
            left={
              // The tray: empty until the shot drops into it, its room kept so the shutter stays centred.
              <span className="relative block size-12 shrink-0 sm:size-14">
                {sending && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sample.photos[0]} alt="" className={clsx("block size-full rounded-control object-cover ring-2 ring-[oklch(1_0_0)]", styles.drop)} />
                )}
              </span>
            }
            middle={
              <button
                type="button"
                onClick={send}
                aria-disabled={sending || imageState !== "ready" || undefined}
                aria-busy={state === "sending" || state === "slow" || undefined}
                aria-label={state === "uncertain" ? "Photo receipt not confirmed" : sending ? "Sending the photo" : state === "retry" ? "Try sending the photo again" : "Take the photo and send it"}
                aria-keyshortcuts="Space"
                className={clsx(
                  "flex size-[4.5rem] items-center justify-center rounded-full border-4 border-[oklch(1_0_0/0.9)] transition-opacity duration-160 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus aria-disabled:opacity-35",
                  styles.shutter,
                )}
              >
                <span className="size-[3.625rem] rounded-full bg-[oklch(1_0_0)]" />
              </button>
            }
          />
        </div>
      )}
    </section>
  );
}
