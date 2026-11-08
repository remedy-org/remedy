"use client";

import clsx from "clsx";
import { useState } from "react";
import { ArrowLeftIcon, Button } from "@/components/ui";
import type { DemoSample } from "@/lib/demo";
import { SAMPLE_COPY, sampleTitle } from "@/lib/demo/sampleCopy";
import { rememberAspect } from "./ClaimPhotos";
import { CodeTag } from "./CodeTag";
import { photoWidth } from "./Exhibit";
import styles from "./flow.module.css";
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
// From 640px to 1024px the camera card hugs its photo (as wide as photoWidth draws it, plus the dock's room), so it
// isn't a wide black box around a narrow strip. Spelled out so Tailwind finds it.
const HUG = "sm:max-lg:mx-auto sm:max-lg:w-[min(100%,calc(min(55svh,100svh_-_18rem)*2/3_+_10rem))]";

/**
 * A demo claim's photo step. A claim photographed in the claim's camera shows in the live camera's own chrome: the
 * photo in the viewfinder with the guide, and the round shutter, which flashes; the photo drops into the tray and the
 * checks begin. A picture pulled from the web wasn't taken in any camera of ours, so it shows as what it is, a flat
 * picture with a plain "Send this picture". The server sends its own copy of the photo; nothing about the checks changes.
 */
export function DemoCaptureStep({ claimId, code, sample, onSent, backHref, written, preview }: DemoCaptureStepProps) {
  const [sending, setSending] = useState(preview?.sending ?? false);
  const [error, setError] = useState<string | null>(preview?.sendError ?? null);
  const [flash, setFlash] = useState(false);
  const title = sampleTitle(sample.id, sample.title);
  const upload = !sample.liveSession;

  async function send() {
    if (sending) return;
    setSending(true);
    setError(null);
    // The shutter's flash is motion: a reduced-motion setting skips it rather than popping it.
    if (!upload && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setFlash(true);
      setTimeout(() => setFlash(false), 40);
    }
    rememberAspect(claimId, 1, ASPECT, 1);
    try {
      const [res] = await Promise.all([fetch(`/api/claims/${claimId}/photos`, { method: "POST", body: new FormData() }), new Promise((r) => setTimeout(r, upload ? 0 : DROP_MS))]);
      const body = await res.json().catch(() => null);
      if (res.status === 409) return onSent(null, sample.photos);
      if (!res.ok) {
        setError(body?.error ?? "The photo didn't send. Try again.");
        setSending(false);
        return;
      }
      onSent(body as ClaimView, sample.photos);
    } catch {
      setError("No connection. Try again when you're back online.");
      setSending(false);
    }
  }

  // The owner's situation in one line: what is in the photo, never what the checks will make of it.
  const line = SAMPLE_COPY[sample.id]?.line ?? sample.description;
  const back = (
    <a href={backHref} className={CAMERA_BACK}>
      <ArrowLeftIcon className="shrink-0" /> All four claims
    </a>
  );

  return (
    <section aria-label={title} className="grid w-full max-w-[40rem] items-start gap-5 lg:max-w-none lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-6">
      {upload ? (
        // A picture from the web: no viewfinder, no shutter. The picture on its own, and the button that sends it.
        <div className="flex flex-col gap-5 lg:row-span-2">
          <a href={backHref} className="inline-flex min-h-11 items-center gap-1.5 self-start text-ui text-muted hover:text-text lg:hidden">
            <ArrowLeftIcon className="shrink-0" /> All four claims
          </a>
          <div className="flex flex-col gap-1 lg:hidden">
            <h1 id="sample-title" tabIndex={-1} className="text-title font-medium text-balance text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-4">
              {title}
            </h1>
            <p className="text-body text-pretty text-muted">{line}</p>
          </div>
          <figure className="flex flex-col gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sample.photos[0]} alt={`The picture: ${title.toLowerCase()}`} style={{ aspectRatio: ASPECT, width: photoWidth(ASPECT) }} className="block h-auto rounded-card bg-surface-2 object-cover ring-1 ring-line" />
            <figcaption className="text-ui text-muted">A picture file, not a photo from this claim&apos;s camera</figcaption>
          </figure>
          {/* As wide as the picture above it, never narrower than its label needs. */}
          <div className="max-w-full" style={{ width: `max(min(100%, 16rem), ${photoWidth(ASPECT)})` }}>
            <Button onClick={send} pending={sending} pendingLabel="Sending…" size="lg" block>
              Send this picture
            </Button>
          </div>
        </div>
      ) : (
        <div data-theme="dark" data-camera="" className={clsx(CAMERA_FRAME, HUG, "lg:row-span-2")}>
          <CameraTopBar back={back}>
            <span className="text-[oklch(0.96_0.006_85)]">
              <span className="sr-only">Code </span>
              <span className="font-mono">{code}</span>
            </span>
          </CameraTopBar>
          {/* The photo whole at its own shape (the tag is what the checks read), at the size the checking screen keeps. The
              code is the bar's (and the tag's beside it on a laptop), so the frame carries only the guide. */}
          <div className="relative flex min-h-0 justify-center overflow-hidden max-sm:items-center">
            <figure className="relative" style={{ aspectRatio: ASPECT, width: photoWidth(ASPECT) }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sample.photos[0]} alt={`Photo: ${title.toLowerCase()}`} className="absolute inset-0 size-full object-contain" />
              <Cutout className="inset-x-[4%] inset-y-[5%]" />
              <div aria-hidden="true" className={clsx("pointer-events-none absolute inset-0 bg-[oklch(1_0_0)]", flash ? clsx("opacity-50", styles.flashOn) : clsx("opacity-0", styles.flashOff))} />
            </figure>
          </div>
          {/* Below 1024px: what the photo is, under the frame. A laptop has it in the right column. */}
          <InstructionBar className="flex-col items-start gap-1 px-5 py-3 text-left lg:hidden">
            <h1 id="sample-title" tabIndex={-1} className="text-ui font-medium text-balance text-[oklch(0.96_0.006_85)] outline-none focus-visible:outline-2 focus-visible:outline-offset-4">
              {title}
            </h1>
            {/* A short window (a laptop at 200%) keeps the title alone, so the shutter stays on the first screen. */}
            <p className="text-ui text-[oklch(0.86_0.005_80)] [@media(max-height:600px)]:hidden">{line}</p>
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
                disabled={sending}
                aria-label="Take the photo and send it"
                className={clsx(
                  "flex size-[4.5rem] items-center justify-center rounded-full border-4 border-[oklch(1_0_0/0.9)] transition-opacity duration-160 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus disabled:opacity-35",
                  styles.shutter,
                )}
              >
                <span className="size-[3.625rem] rounded-full bg-[oklch(1_0_0)]" />
              </button>
            }
          />
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {sending ? (upload ? "Sending the picture." : "Photo taken. Sending it.") : ""}
      </p>

      <div className="hidden flex-col gap-6 lg:col-start-2 lg:flex">
        <div className="flex flex-col gap-3">
          <h1 id="sample-title-wide" tabIndex={-1} className="text-title font-medium text-balance text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-4">
            {title}
          </h1>
          <p className="text-body text-pretty text-muted">{line}</p>
        </div>
        {/* This claim's code, as the owner would have written it: the tag in the photo is checked against it. */}
        <figure className="flex flex-col gap-3">
          <CodeTag code={code} written={written} />
          <figcaption className="text-ui text-muted">
            {upload ? "Your one-time code. Only a photo taken in this claim's camera can carry it." : "Your one-time code. Write it on the tag, then press the shutter."}
          </figcaption>
        </figure>
      </div>
      {error && (
        <div className="lg:col-start-2">
          <Notice title="The photo didn't send">{error}</Notice>
        </div>
      )}
    </section>
  );
}
