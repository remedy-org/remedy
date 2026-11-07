"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { Button, CrossIcon } from "@/components/ui";
import { Keys } from "./Keys";

export interface PhotoViewerProps {
  claimId: string;
  /** The claim's photo routes; the viewer loads each at full size. */
  photos: string[];
  /** The photo that was clicked (0-based). */
  start: number;
  sample: boolean;
  /** The one-time code the tag must read: on top, beside the photos it is checked against. */
  code?: string;
  /** What decided a held or refused claim, as the panel's callout says it: the question to look at the photos with. */
  question?: { lead: string; text: string } | null;
  /** Held: approve or reject from here. The viewer closes and the panel's footer opens the same confirm. */
  onReview?: (mode: "approve" | "reject") => void;
  onClose: () => void;
}

/**
 * The photos full size, over the console: every photo of the claim side by side, uncropped, with the claim id and the
 * question that held it on top. ← and → move between the photos, Esc goes back to the panel (the dialog returns focus
 * to the thumbnail that opened it). On a phone it shows one photo at a time.
 */
export function PhotoViewer({ claimId, photos, start, sample, code, question, onReview, onClose }: PhotoViewerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const figures = useRef<(HTMLElement | null)[]>([]);
  const [current, setCurrent] = useState(start);

  useEffect(() => {
    ref.current?.showModal();
    figures.current[start]?.focus();
  }, [start]);

  const go = (step: number) => {
    const next = (current + step + photos.length) % photos.length;
    setCurrent(next);
    figures.current[next]?.focus();
  };
  const review = (mode: "approve" | "reject") => {
    onReview?.(mode);
    ref.current?.close();
  };

  return (
    <dialog
      ref={ref}
      // React bubbles close through its own tree: on tablets and phones the viewer sits inside the evidence sheet, itself
      // a dialog, which must stay open.
      onClose={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onKeyDown={(e) => {
        if (photos.length < 2 || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
        e.preventDefault();
        go(e.key === "ArrowRight" ? 1 : -1);
      }}
      aria-labelledby="viewer-title"
      className="fixed inset-0 m-auto flex h-[calc(100dvh-2rem)] max-h-none w-[calc(100vw-2rem)] max-w-none flex-col overflow-hidden rounded-card bg-surface p-0 text-text shadow-float backdrop:bg-[oklch(0.1_0.004_75/0.7)]"
    >
      <header className="flex items-start gap-4 border-b border-line px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <h2 id="viewer-title" className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-mono text-body font-medium">{claimId}</span>
            <span className="micro text-faint">
              {photos.length === 1 ? "Photo 1" : `Photos 1 to ${photos.length}`}
              {sample ? " · AI-made test photos" : ""}
            </span>
          </h2>
          {question && (
            <p className="mt-1 text-ui text-muted">
              <span className="text-text-2">{question.lead}:</span> {question.text}
            </p>
          )}
        </div>
        {code && (
          <p className="flex shrink-0 items-baseline gap-2 self-center text-ui text-muted">
            Tag must read <span className="font-mono text-head-sm font-medium tracking-wide text-text">{code}</span>
          </p>
        )}
        <button
          type="button"
          onClick={() => ref.current?.close()}
          className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-text"
          aria-label="Back to the evidence"
        >
          <CrossIcon />
        </button>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 p-4 sm:p-5" style={{ gridTemplateColumns: `repeat(${photos.length}, minmax(0, 1fr))` }}>
        {photos.map((src, i) => (
          <figure
            key={src}
            ref={(el) => {
              figures.current[i] = el;
            }}
            tabIndex={-1}
            aria-label={`Photo ${i + 1} of ${photos.length}${sample ? ", an AI-made test photo" : ""}`}
            // A phone shows the current photo alone; wider screens show them all.
            className={clsx("flex min-h-0 min-w-0 flex-col gap-2 rounded-control outline-none max-sm:col-span-full", i !== current && "max-sm:hidden")}
          >
            <div className={clsx("relative min-h-0 flex-1 overflow-hidden rounded-control border bg-surface-2", i === current && photos.length > 1 ? "border-line-strong" : "border-line")}>
              {/* A private, session-checked route at full size: next/image's optimizer can't fetch it with the cookie. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Photo ${i + 1} of ${photos.length} for ${claimId}`} className="absolute inset-0 size-full object-contain" />
              {sample && (
                <span className="micro absolute inset-x-0 bottom-0 bg-[oklch(0.155_0.004_75/0.78)] px-2 py-1 text-[oklch(0.96_0.006_85)]">AI-made test photo</span>
              )}
            </div>
            <figcaption className={clsx("font-mono text-micro", i === current ? "text-text" : "text-muted")}>
              Photo {i + 1} of {photos.length}
            </figcaption>
          </figure>
        ))}
      </div>

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line px-5 py-3">
        {onReview && (
          <div className="flex flex-wrap gap-3">
            <Button size="sm" onClick={() => review("approve")}>
              Approve…
            </Button>
            <Button size="sm" variant="secondary" onClick={() => review("reject")}>
              Reject…
            </Button>
          </div>
        )}
        <p className="ml-auto flex items-center gap-4 font-mono text-[11px] text-faint" aria-hidden="true">
          {photos.length > 1 && <Keys k={["←", "→"]}>Switch photo</Keys>}
          <Keys k={["Esc"]}>Back to the evidence</Keys>
        </p>
      </footer>
    </dialog>
  );
}
