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
    <Tag id={id} tabIndex={-1} className={clsx("text-title font-medium text-balance text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-4", className)}>
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

// The checking screen and the result: from 1024px wide and 601px tall, two columns; phones and short screens stack, with
// the photo as a thumbnail beside the headline. The classes are spelled out so Tailwind finds them.
export const WIDE_ONLY = "hidden lg:[@media(min-height:601px)]:flex";
export const NARROW_ONLY = "lg:[@media(min-height:601px)]:hidden";

/** The width that keeps a photo at most 55% of the screen's height, so its tag never falls below the fold. */
export const photoWidth = (aspect: number) => `min(100%, calc(55svh * ${aspect}))`;

/**
 * The photo on a laptop, under the refund row: as tall as keeps it on the first screen while the checks run (26rem from
 * 1440x900; 1024x768: 25rem), never under 14rem, and as wide as its shape makes it.
 */
export const evidenceWidth = (aspect: number) => `min(100%, calc(clamp(14rem, 100svh - 22rem, 26rem) * ${aspect}))`;

/**
 * One layout from the checking screen to the result, so the outcome lands in place. On a laptop, one 960px grid: on the
 * left the headline, the refund row (which the paid receipt prints out of, pushing what's under it down) and the photo
 * being checked; on the right the five checks, level with the headline. On a phone (or a short screen), one column in
 * the DOM's order: the headline with a small photo, the checks, then the refund row, the way a receipt comes out under
 * a till's last line. The photo is the laptop's alone (the phone has its thumbnail).
 */
export function ClaimLayout({ labelledBy, head, checks, outcome, photo }: { labelledBy: string; head: ReactNode; checks: ReactNode; outcome?: ReactNode; photo?: ReactNode }) {
  return (
    <section
      aria-labelledby={labelledBy}
      // Spelled out so Tailwind finds them: the two columns are lg:[@media(min-height:601px)] only.
      className="grid grid-cols-[minmax(0,1fr)] items-start gap-y-6 lg:[@media(min-height:601px)]:grid-cols-[minmax(0,27rem)_minmax(0,1fr)] lg:[@media(min-height:601px)]:grid-rows-[auto_auto_1fr] lg:[@media(min-height:601px)]:gap-x-16 lg:[@media(min-height:601px)]:gap-y-8 [@media(max-height:600px)]:gap-y-4"
    >
      <div className="min-w-0 lg:[@media(min-height:601px)]:col-start-1 lg:[@media(min-height:601px)]:row-start-1">{head}</div>
      <div className="flex min-w-0 flex-col gap-5 lg:[@media(min-height:601px)]:col-start-2 lg:[@media(min-height:601px)]:row-span-3 lg:[@media(min-height:601px)]:row-start-1">{checks}</div>
      {outcome && <div className="flex min-w-0 flex-col gap-6 lg:[@media(min-height:601px)]:col-start-1 lg:[@media(min-height:601px)]:row-start-2">{outcome}</div>}
      {photo && <div className={clsx(WIDE_ONLY, "min-w-0 flex-col gap-4 lg:[@media(min-height:601px)]:col-start-1 lg:[@media(min-height:601px)]:row-start-3")}>{photo}</div>}
    </section>
  );
}

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
          <div className={clsx(small ? "text-ui text-pretty text-muted" : "text-body text-balance text-text-2")}>{lead}</div>
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
