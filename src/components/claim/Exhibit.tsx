import clsx from "clsx";
import type { ReactNode } from "react";

/** The honest label every rendering of a judges' sample photo carries: they're AI-made, never a real owner's. */
export function SampleChip({ className, children = "AI-made sample photo" }: { className?: string; children?: ReactNode }) {
  return (
    <span className={clsx("inline-flex h-6 items-center rounded-control bg-[oklch(0.12_0.01_255/0.78)] px-2 font-mono text-micro tracking-[0.06em] text-[oklch(0.96_0.005_255)] uppercase backdrop-blur-sm", className)}>
      {children}
    </span>
  );
}

export interface ExhibitPhotoProps {
  src: string;
  alt: string;
  /** The exhibit letter in the amber chip: A for the first photo. */
  letter?: string;
  /** A judges' sample: the AI-made label sits on the photo. */
  sample?: boolean;
  /** Tailwind aspect and size classes for the photo well, e.g. "aspect-[4/3]". */
  frame?: string;
  /** Over the photo: a scan line, a label. */
  children?: ReactNode;
  className?: string;
}

/**
 * A claim photo as an exhibit print: a 3px paper border, the amber letter chip at its corner, and the AI-made label on a
 * sample. The same object the homepage's Chain of Custody hands over (P1's ExhibitPrint), so the flow and the story
 * match.
 */
export function ExhibitPhoto({ src, alt, letter = "A", sample, frame = "aspect-[4/3]", children, className }: ExhibitPhotoProps) {
  return (
    <figure className={clsx("relative rounded-control bg-paper p-[3px] shadow-paper", className)}>
      <div className={clsx("relative overflow-hidden rounded-[3px] bg-surface-2", frame)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="absolute inset-0 size-full object-cover" />
        {sample && <SampleChip className="absolute bottom-2 left-2" />}
        {children}
      </div>
      <span aria-hidden="true" className="absolute -top-2.5 -left-2.5 flex size-6 items-center justify-center rounded-control bg-accent font-mono text-micro font-semibold text-accent-ink shadow-[0_0_0_2px_var(--bg)]">
        {letter}
      </span>
    </figure>
  );
}

/** A screen's title: the h2 that focus moves to on every step change. */
export function StepTitle({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  return (
    <h2 id={id} tabIndex={-1} className={clsx("text-title font-semibold text-balance outline-none focus-visible:outline-2 focus-visible:outline-offset-4", className)}>
      {children}
    </h2>
  );
}
