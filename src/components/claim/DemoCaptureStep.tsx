"use client";

import { useState } from "react";
import { Button, Card, ErrorState, ExhibitLabel } from "@/components/ui";
import type { DemoSample } from "@/lib/demo";
import type { ClaimView } from "./model";

export interface DemoCaptureStepProps {
  claimId: string;
  code: string;
  sample: DemoSample;
  onSent(view: ClaimView | null): void;
  preview?: { sending?: boolean; sendError?: string };
}

/** Demo mode's stand-in for the camera: the sample's photo in the viewfinder, sent by the server from its own copy. */
export function DemoCaptureStep({ claimId, code, sample, onSent, preview }: DemoCaptureStepProps) {
  const [sending, setSending] = useState(preview?.sending ?? false);
  const [error, setError] = useState<string | null>(preview?.sendError ?? null);

  async function send() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/claims/${claimId}/photos`, { method: "POST", body: new FormData() });
      const body = await res.json().catch(() => null);
      if (res.status === 409) return onSent(null);
      if (!res.ok) {
        setError(body?.error ?? "The sample didn't send. Try again.");
        setSending(false);
        return;
      }
      onSent(body as ClaimView);
    } catch {
      setError("No connection. Try again when you're back online.");
      setSending(false);
    }
  }

  return (
    <Card padding="none" as="section" aria-labelledby="sample-title" className="overflow-hidden">
      <figure data-theme="dark" className="relative aspect-[3/4] bg-[oklch(0.12_0.01_255)] sm:aspect-[4/3]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={sample.photos[0]} alt={sample.description} className="absolute inset-0 size-full object-cover" />
        <figcaption className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3">
          <span className="inline-flex h-7 items-center rounded-control bg-[oklch(0.12_0.01_255/0.72)] px-2.5 font-mono text-ui text-muted backdrop-blur-sm">
            Sample photo
          </span>
          <span className="inline-flex h-7 items-center rounded-control bg-[oklch(0.12_0.01_255/0.72)] px-2.5 font-mono text-ui text-muted backdrop-blur-sm">
            {sample.liveSession ? "In this session" : "Sent from outside"}
          </span>
        </figcaption>
      </figure>

      <div className="flex flex-col gap-5 p-6">
        <div className="flex flex-col gap-2">
          <ExhibitLabel leader="left" leaderLength={16}>
            {sample.title} · code {code}
          </ExhibitLabel>
          <h2 id="sample-title" className="text-body font-medium text-text">
            {sample.description}
          </h2>
        </div>
        {error && <ErrorState variant="inline" title="The sample didn't send" description={error} />}
        <Button size="lg" block onClick={send} pending={sending} pendingLabel="Sending the sample…">
          Send this photo
        </Button>
      </div>
    </Card>
  );
}
