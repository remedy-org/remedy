"use client";

import clsx from "clsx";
import { useState } from "react";
import { Button, ErrorState } from "@/components/ui";
import type { DemoSample } from "@/lib/demo";
import { sampleTitle } from "@/lib/demo/sampleCopy";
import styles from "./flow.module.css";
import type { ClaimView } from "./model";
import { CAMERA_FRAME, CAMERA_VIEW, Dock, GlassChip, InstructionBar } from "./Viewfinder";

export interface DemoCaptureStepProps {
  claimId: string;
  code: string;
  sample: DemoSample;
  onSent(view: ClaimView | null, photoUrls?: string[]): void;
  preview?: { sending?: boolean; sendError?: string };
}

/**
 * A demo claim's photo step: its photo in the same viewfinder chrome as the live camera, this claim's code beside what
 * the tag in the photo reads, and "Send photo" in place of the shutter. The server sends its own copy of the photo.
 */
export function DemoCaptureStep({ claimId, code, sample, onSent, preview }: DemoCaptureStepProps) {
  const [sending, setSending] = useState(preview?.sending ?? false);
  const [error, setError] = useState<string | null>(preview?.sendError ?? null);
  const [flash, setFlash] = useState(false);

  async function send() {
    setSending(true);
    setError(null);
    setFlash(true);
    setTimeout(() => setFlash(false), 40);
    try {
      const res = await fetch(`/api/claims/${claimId}/photos`, { method: "POST", body: new FormData() });
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

  return (
    <section aria-labelledby="sample-title" className="flex w-full max-w-[40rem] flex-col gap-5">
      <div data-theme="dark" data-camera="" className={CAMERA_FRAME}>
        {/* On a short screen (a laptop at 200% zoom) the photo gives up height, so its heading and button fit beside it. */}
        <figure className={clsx(CAMERA_VIEW, "sm:max-h-[55svh] sm:w-full [@media(max-height:600px)]:max-h-[40svh]")}>
          {/* The photos are 2:3 portraits: framed from 70% down, so the tag and its code stay in the 4:3 frame. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sample.photos[0]} alt={`Photo 1: ${sampleTitle(sample.id, sample.title).toLowerCase()}`} className="absolute inset-0 size-full object-cover object-[50%_70%]" />
          <GlassChip className="absolute top-3 left-3">Photo 1</GlassChip>
          <div aria-hidden="true" className={clsx("pointer-events-none absolute inset-0 bg-[oklch(1_0_0)]", flash ? clsx("opacity-50", styles.flashOn) : clsx("opacity-0", styles.flashOff))} />
        </figure>
        <InstructionBar className="flex-col gap-1">
          <h2 id="sample-title" tabIndex={-1} className="text-ui font-medium text-balance text-[oklch(0.96_0.006_85)] outline-none focus-visible:outline-2 focus-visible:outline-offset-4">
            {sampleTitle(sample.id, sample.title)}
          </h2>
          <p className="text-ui text-[oklch(0.86_0.005_80)]">
            This claim&apos;s code is <span className="font-mono whitespace-nowrap">{code}</span>. The tag reads <span className="font-mono whitespace-nowrap">{sample.tagReads}</span>.
          </p>
        </InstructionBar>
        <Dock
          short
          className="border-t border-[oklch(1_0_0/0.08)]"
          middle={
            <Button size="lg" onClick={send} pending={sending} pendingLabel="Sending…" className="min-w-56">
              Send photo
            </Button>
          }
        />
      </div>
      {error && <ErrorState variant="inline" title="The photo didn't send" description={error} />}
    </section>
  );
}
