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

/**
 * A screen's title: the page's h1, which focus moves to on every step change. The recall screen's card, beside the
 * recall's own h1, passes "h2".
 */
export function StepTitle({ id, as: Tag = "h1", className, children }: { id: string; as?: "h1" | "h2"; className?: string; children: ReactNode }) {
  return (
    <Tag id={id} tabIndex={-1} className={clsx("text-title font-semibold text-balance text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-4", className)}>
      {children}
    </Tag>
  );
}

/**
 * Every step's two columns from 1024px, the same two halves of the 960px frame on every screen: the exhibit on the left
 * (the recall, the tag, the viewfinder, the photo), the state and the action on the right. Nothing changes shape from
 * step to step; phones stack them.
 */
export const STEP_GRID = "grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-2 lg:gap-16";

// The checking screen and the result share one grid, so the outcome lands in place: from 1024px wide and 601px tall
// the photo whole on the left; phones and short screens stack, with the photo as a thumbnail beside the headline. The
// classes are spelled out so Tailwind finds them.
export const CHECK_GRID = "grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:[@media(min-height:601px)]:grid-cols-2 lg:[@media(min-height:601px)]:gap-16";
export const WIDE_ONLY = "hidden lg:[@media(min-height:601px)]:flex";
export const NARROW_ONLY = "lg:[@media(min-height:601px)]:hidden";

/** The width that keeps a photo at most 55% of the screen's height, so its tag never falls below the fold. */
export const photoWidth = (aspect: number) => `min(100%, calc(55svh * ${aspect}))`;

/**
 * The headline the checking screen and the result share: on a phone the photo's thumbnail beside it, the title, and one
 * line under it whose height is kept even when it's empty, so the checks under it never move when the outcome lands.
 */
export function OutcomeHead({ id, thumb, title, lead, small, aside }: { id: string; thumb?: string; title: ReactNode; lead?: ReactNode; small?: boolean; aside?: ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      {thumb && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt="" className={clsx("size-18 shrink-0 rounded-control bg-surface-2 object-cover object-[50%_70%] ring-1 ring-line [@media(max-height:600px)]:size-14", NARROW_ONLY)} />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <StepTitle id={id}>{title}</StepTitle>
        {lead ? (
          <div className={clsx("text-pretty text-muted", small ? "text-ui" : "text-body")}>{lead}</div>
        ) : (
          <p aria-hidden="true" className="invisible text-ui">
            {"\u00a0"}
          </p>
        )}
      </div>
      {aside}
    </div>
  );
}

/**
 * Every step's frame: one 960px column, centred, with the step meter on top, the same on every screen (and the header's
 * and footer's edges), so nothing moves sideways from step to step.
 */
export function ClaimFrame({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("mx-auto flex w-full max-w-[60rem] flex-col gap-8 sm:gap-10", className)}>{children}</div>;
}
