"use client";

import clsx from "clsx";
import { useState } from "react";
import { Button, ErrorState, ExhibitLabel } from "@/components/ui";
import type { DemoSample } from "@/lib/demo";
import styles from "./flow.module.css";
import type { ClaimView } from "./model";
import { CAMERA_FRAME, CAMERA_VIEW, Cutout, Dock, GlassChip, InstructionBar } from "./Viewfinder";

export interface DemoCaptureStepProps {
  claimId: string;
  code: string;
  sample: DemoSample;
  reminders?: string[];
  onSent(view: ClaimView | null, photoUrl?: string): void;
  preview?: { sending?: boolean; sendError?: string };
}

/**
 * Demo mode's stand-in for the camera, and the demo claim's first screen: the sample's photo inside the same viewfinder
 * chrome, labelled as an AI-made sample, with this claim's code, what the photo must show, and what the tag in it
 * actually reads; "Send this sample" in place of the shutter. The server sends its own copy of the photo.
 */
export function DemoCaptureStep({ claimId, code, sample, reminders = [], onSent, preview }: DemoCaptureStepProps) {
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
      if (res.status === 409) return onSent(null, sample.photos[0]);
      if (!res.ok) {
        setError(body?.error ?? "The sample didn't send. Try again.");
        setSending(false);
        return;
      }
      onSent(body as ClaimView, sample.photos[0]);
    } catch {
      setError("No connection. Try again when you're back online.");
      setSending(false);
    }
  }

  return (
    <section aria-labelledby="sample-title" className="mx-auto flex w-full max-w-[40rem] flex-col gap-5">
      <div data-theme="dark" data-camera="" className={CAMERA_FRAME}>
        <figure className={CAMERA_VIEW}>
          {/* The samples are 2:3 portraits: framed from 70% down, so the tag and its code stay in the 4:3 frame. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sample.photos[0]} alt={sample.description} className="absolute inset-0 size-full object-cover object-[50%_70%]" />
          <Cutout>
            <GlassChip className="absolute top-2 left-2">Photo 1</GlassChip>
          </Cutout>
          <figcaption className="absolute top-3 left-3">
            <GlassChip>AI-made sample · not from a camera</GlassChip>
          </figcaption>
          <div aria-hidden="true" className={clsx("pointer-events-none absolute inset-0 bg-[oklch(1_0_0)]", flash ? clsx("opacity-50", styles.flashOn) : clsx("opacity-0", styles.flashOff))} />
        </figure>
        <InstructionBar className="flex-col gap-2">
          <h2 id="sample-title" tabIndex={-1} className="text-ui font-medium text-[oklch(0.96_0.006_85)] outline-none focus-visible:outline-2 focus-visible:outline-offset-4">
            {sample.title}. This claim&apos;s code is <span className="font-mono whitespace-nowrap">{code}</span>
          </h2>
          {/* What the photo needs, as requirements, under the frame rather than over the tag it points at. */}
          {reminders.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <span id="sample-must" className="font-mono text-micro tracking-[0.06em] text-[oklch(0.74_0.005_80)] uppercase">
                Must show
              </span>
              <ul aria-labelledby="sample-must" className="flex flex-wrap justify-center gap-1.5">
                {reminders.map((t) => (
                  <li key={t} className="inline-flex h-6 items-center rounded-control border border-[oklch(1_0_0/0.18)] px-2 font-mono text-micro tracking-[0.06em] whitespace-nowrap text-[oklch(0.86_0.005_80)] uppercase">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-ui text-[oklch(0.86_0.005_80)]">
            The tag in this photo reads <span className="font-mono whitespace-nowrap">{sample.tagReads}</span>
            {sample.tagReads === code ? ": this claim's code." : <>, not <span className="font-mono whitespace-nowrap">{code}</span>.</>}
          </p>
        </InstructionBar>
        <Dock
          short
          className="border-t border-[oklch(1_0_0/0.08)]"
          left={
            <ExhibitLabel leader="none" className="max-sm:hidden">
              Sample · code {code}
            </ExhibitLabel>
          }
          middle={
            <Button size="lg" onClick={send} pending={sending} pendingLabel="Sending the sample…" className="min-w-56">
              Send this sample
            </Button>
          }
        />
      </div>
      <p className="text-body text-muted max-sm:pt-1">{sample.description}</p>
      {error && <ErrorState variant="inline" title="The sample didn't send" description={error} />}
    </section>
  );
}
