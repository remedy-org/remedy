import clsx from "clsx";
import type { ReactNode } from "react";

export interface ExhibitPhotoProps {
  src: string;
  alt: string;
  /** The photo's number in a corner chip, as the camera numbers them, when a claim has more than one. */
  n?: number;
  /** Tailwind aspect and size classes for the photo well, e.g. "aspect-[3/4]". */
  frame?: string;
  /** contain: the whole photo, for one shown beside the claim it decided (a tall photo's tag stays in). */
  fit?: "cover" | "contain";
  /** Where a covered photo is anchored: the samples' tags sit low in the frame. */
  position?: string;
  className?: string;
}

/** A claim photo: flat, with a hairline, and its number when there are several. */
export function ExhibitPhoto({ src, alt, n, frame = "aspect-[4/3]", fit = "cover", position, className }: ExhibitPhotoProps) {
  return (
    <figure className={clsx("relative overflow-hidden rounded-control bg-surface-2 ring-1 ring-line", frame, className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className={clsx("absolute inset-0 size-full", fit === "contain" ? "object-contain" : "object-cover", position)} />
      {n !== undefined && (
        <span aria-hidden="true" className="absolute top-2 left-2 flex h-5 min-w-5 items-center justify-center rounded-[4px] bg-[oklch(0.12_0.004_75/0.78)] px-1 font-mono text-micro text-[oklch(0.96_0.006_85)]">
          {n}
        </span>
      )}
    </figure>
  );
}

/** A screen's title: the h2 that focus moves to on every step change. */
export function StepTitle({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  return (
    <h2 id={id} tabIndex={-1} className={clsx("text-title font-semibold text-balance text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-4", className)}>
      {children}
    </h2>
  );
}

/**
 * Every step's frame: one centred column, the step meter on top, so the meter's edges and the content's are the same on
 * every screen: 960px, or 640px (`narrow`) for the single-column steps, the camera and the claim picker.
 */
export function ClaimFrame({ children, narrow, className }: { children: ReactNode; narrow?: boolean; className?: string }) {
  return <div className={clsx("mx-auto flex w-full flex-col gap-8 sm:gap-10", narrow ? "max-w-[40rem]" : "max-w-[60rem]", className)}>{children}</div>;
}
