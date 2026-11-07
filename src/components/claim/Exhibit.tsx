import clsx from "clsx";
import type { ReactNode } from "react";

/** The honest label every rendering of a judges' sample photo carries: they're AI-made, never a real owner's. */
export function SampleChip({ className, children = "AI-made sample photo" }: { className?: string; children?: ReactNode }) {
  return (
    <span className={clsx("inline-flex h-6 items-center rounded-control bg-[oklch(0.12_0.004_75/0.78)] px-2 font-mono text-micro tracking-[0.06em] text-[oklch(0.96_0.006_85)] uppercase backdrop-blur-sm", className)}>
      {children}
    </span>
  );
}

export interface ExhibitPhotoProps {
  src: string;
  alt: string;
  /** The photo's number in the corner chip, as the camera numbers them (letters are the judges' samples, A to D). */
  n?: number;
  /** A judges' sample: the AI-made label sits on the photo. */
  sample?: boolean;
  /** Tailwind aspect and size classes for the photo well, e.g. "aspect-[4/3]". */
  frame?: string;
  /** contain: the whole photo, on the print's well, for a photo shown as the thing being checked (a tall photo's tag stays in). */
  fit?: "cover" | "contain";
  /** Over the photo: a scan line, a label. */
  children?: ReactNode;
  className?: string;
}

/**
 * A claim photo as an exhibit print: a 3px paper border, the photo number chip in its corner, and the AI-made label on a
 * sample. The same object the homepage's Chain of Custody hands over (P1's ExhibitPrint), so the flow and the story
 * match. The chip sits inside the print, so nothing hangs off its edge.
 */
export function ExhibitPhoto({ src, alt, n = 1, sample, frame = "aspect-[4/3]", fit = "cover", children, className }: ExhibitPhotoProps) {
  return (
    <figure className={clsx("relative rounded-control bg-paper p-[3px] shadow-paper", className)}>
      <div className={clsx("relative overflow-hidden rounded-[3px] bg-surface-2", frame)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className={clsx("absolute inset-0 size-full", fit === "contain" ? "object-contain" : "object-cover")} />
        {sample && <SampleChip className="absolute bottom-2 left-2" />}
        {children}
      </div>
      <span aria-hidden="true" className="absolute top-1.5 left-1.5 flex size-6 items-center justify-center rounded-control bg-paper font-mono text-micro font-medium text-ink shadow-[0_0_0_1px_var(--paper-line)]">
        {n}
      </span>
    </figure>
  );
}

/** A screen's title: the h2 that focus moves to on every step change. */
export function StepTitle({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  return (
    <h2 id={id} tabIndex={-1} className={clsx("text-title font-medium text-balance outline-none focus-visible:outline-2 focus-visible:outline-offset-4", className)}>
      {children}
    </h2>
  );
}
