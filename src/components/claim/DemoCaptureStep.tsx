"use client";

import clsx from "clsx";
import { useState } from "react";
import type { DemoSample } from "@/lib/demo";
import { SAMPLE_COPY, sampleTitle } from "@/lib/demo/sampleCopy";
import { rememberAspect } from "./ClaimPhotos";
import { CodeTag } from "./CodeTag";
import { photoWidth } from "./Exhibit";
import styles from "./flow.module.css";
import type { ClaimView } from "./model";
import { Notice } from "./Notice";
import { CAMERA_BACK, CAMERA_FRAME, CameraTopBar, Cutout, Dock, GlassChip, InstructionBar } from "./Viewfinder";

export interface DemoCaptureStepProps {
  claimId: string;
  code: string;
  sample: DemoSample;
  onSent(view: ClaimView | null, photoUrls?: string[]): void;
  /** The claim picker: the camera's top bar leads back to it on a phone. */
  backHref: string;
  /** The label hand-written on the tag beside the code, for the tag beside the camera on a laptop. */
  written?: string | null;
  preview?: { sending?: boolean; sendError?: string };
}

// The demo photos are 2:3 portrait: drawn at that shape here, so the checking screen shows them at the same size.
const ASPECT = 2 / 3;
// Long enough for the photo to drop into its slot before the checks take over the screen.
const DROP_MS = 480;

/**
 * A demo claim's photo step, in the live camera's own chrome: the photo in the viewfinder with the guide, the photo
 * number and this claim's code on it, and the round shutter. The shutter flashes, the photo drops into the tray, and the
 * checks begin. The server sends its own copy of the photo; nothing about the checks changes.
 */
export function DemoCaptureStep({ claimId, code, sample, onSent, backHref, written, preview }: DemoCaptureStepProps) {
  const [sending, setSending] = useState(preview?.sending ?? false);
  const [error, setError] = useState<string | null>(preview?.sendError ?? null);
  const [flash, setFlash] = useState(false);
  const title = sampleTitle(sample.id, sample.title);

  async function send() {
    if (sending) return;
    setSending(true);
    setError(null);
    setFlash(true);
    setTimeout(() => setFlash(false), 40);
    rememberAspect(claimId, 1, ASPECT, 1);
    try {
      const [res] = await Promise.all([fetch(`/api/claims/${claimId}/photos`, { method: "POST", body: new FormData() }), new Promise((r) => setTimeout(r, DROP_MS))]);
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

  return (
    <section aria-label={title} className="grid w-full max-w-[40rem] items-start gap-5 lg:max-w-none lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-6">
      <div data-theme="dark" data-camera="" className={clsx(CAMERA_FRAME, "lg:row-span-2")}>
        <CameraTopBar
          back={
            <a href={backHref} className={CAMERA_BACK}>
              <span aria-hidden="true">←</span> All four claims
            </a>
          }
        >
          <span className="font-mono text-[oklch(0.96_0.006_85)]">{code}</span>
        </CameraTopBar>
        {/* The photo whole at its own shape (the tag is what the checks read), at the size the checking screen keeps. */}
        <div className="relative flex min-h-0 justify-center overflow-hidden max-sm:items-center">
          <figure className="relative" style={{ aspectRatio: ASPECT, width: photoWidth(ASPECT) }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sample.photos[0]} alt={`Photo 1: ${title.toLowerCase()}`} className="absolute inset-0 size-full object-contain" />
            <Cutout className="inset-x-[4%] inset-y-[5%]">
              <GlassChip className="absolute top-2 left-2">Photo 1</GlassChip>
              <GlassChip mono className="absolute top-2 right-2">
                {code}
              </GlassChip>
            </Cutout>
            <div aria-hidden="true" className={clsx("pointer-events-none absolute inset-0 bg-[oklch(1_0_0)]", flash ? clsx("opacity-50", styles.flashOn) : clsx("opacity-0", styles.flashOff))} />
          </figure>
        </div>
        {/* A phone: what the photo is, under the frame. A laptop has it in the right column. */}
        <InstructionBar className="flex-col items-start gap-1 px-5 py-3 text-left lg:hidden">
          <h1 id="sample-title" tabIndex={-1} className="text-ui font-medium text-balance text-[oklch(0.96_0.006_85)] outline-none focus-visible:outline-2 focus-visible:outline-offset-4">
            {title}
          </h1>
          <p className="text-ui text-[oklch(0.86_0.005_80)]">{line}</p>
        </InstructionBar>
        <Dock
          short
          className="border-t border-[oklch(1_0_0/0.08)]"
          left={
            <span className="relative block size-12 shrink-0 sm:size-14">
              {sending ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sample.photos[0]} alt="" className={clsx("block size-full rounded-control object-cover ring-2 ring-[oklch(1_0_0)]", styles.drop)} />
              ) : (
                <span className="block size-full rounded-control border border-[oklch(1_0_0/0.18)]" />
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
        <p className="sr-only" aria-live="polite">
          {sending ? "Photo taken. Sending it." : ""}
        </p>
      </div>

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
          <figcaption className="text-ui text-muted">This claim&apos;s code. The shutter sends the photo to the five checks.</figcaption>
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
