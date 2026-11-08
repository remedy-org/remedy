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

/**
 * The width that keeps a photo at most 55% of the screen's height, so its tag never falls below the fold; on a short
 * window (a laptop at 200%), small enough that the camera's bars and its shutter fit under it too. The camera's photo and
 * the checking screen's are the same size, so the shutter's hand-off is a move, never a shrink.
 */
export const photoWidth = (aspect: number) => `min(100%, calc(55svh * ${aspect}), calc((100svh - 18rem) * ${aspect}))`;

/** The photo being checked, one element from the camera's shutter to the result: the View Transition carries it. */
export const PHOTO_TRANSITION = "claim-photo";

// The two columns' media query, from 1024px wide and 601px tall, spelled out per class so Tailwind finds them.
const COL1 = "lg:[@media(min-height:601px)]:col-start-1 lg:[@media(min-height:601px)]:row-span-3 lg:[@media(min-height:601px)]:row-start-1";
const COL2 = "lg:[@media(min-height:601px)]:col-start-2";

/**
 * One layout from the checking screen to the result, so the outcome lands in place. On a laptop, the step grid's two
 * halves: on the left, exactly where the camera's viewfinder was and at its size, the photo being checked, alone; on the
 * right, where the camera's title was, the headline, the five checks ticking under it, then the refund row (which the
 * paid receipt prints out of, or the way on replaces): the order the homepage's laptop shows it in. The left column
 * never changes from the shutter to the result. On a phone (or a short screen), one column in the same order, the photo
 * as a thumbnail beside the headline. The photo is the laptop's alone, last in the DOM, so a screen reader meets the
 * headline first.
 */
export function ClaimLayout({ labelledBy, head, checks, outcome, photo }: { labelledBy: string; head: ReactNode; checks: ReactNode; outcome?: ReactNode; photo?: ReactNode }) {
  return (
    <section
      aria-labelledby={labelledBy}
      className="grid grid-cols-[minmax(0,1fr)] items-start gap-y-6 lg:[@media(min-height:601px)]:grid-cols-2 lg:[@media(min-height:601px)]:grid-rows-[auto_auto_1fr] lg:[@media(min-height:601px)]:gap-x-16 [@media(max-height:600px)]:gap-y-4"
    >
      <div className={clsx("min-w-0 lg:[@media(min-height:601px)]:row-start-1", COL2)}>{head}</div>
      <div className={clsx("flex min-w-0 flex-col gap-6 lg:[@media(min-height:601px)]:row-start-2", COL2)}>{checks}</div>
      {outcome && <div className={clsx("flex min-w-0 flex-col gap-6 lg:[@media(min-height:601px)]:row-start-3", COL2)}>{outcome}</div>}
      {photo && <div className={clsx(WIDE_ONLY, "min-w-0 flex-col gap-3", COL1)}>{photo}</div>}
    </section>
  );
}

/**
 * The headline the checking screen and the result share: on a phone the photo's thumbnail beside it, the title, and one
 * line under it whose height is kept even when it's empty, so the checks under it never move when the outcome lands.
 * Below 640px that line runs the full width under the thumbnail, so a two-sentence reason never squeezes beside it.
 */
export function OutcomeHead({ id, thumb, title, lead, small, aside }: { id: string; thumb?: string; title: ReactNode; lead?: ReactNode; small?: boolean; aside?: ReactNode }) {
  // A reason (the result's) runs the full width under the thumbnail on a phone; the checking screen's line stays beside it.
  const wide = Boolean(lead) && !small;
  return (
    // No column gap: a thumbnail hidden on a laptop leaves its column at 0 wide, so the title keeps the column's edge.
    <div className={clsx("grid grid-cols-[auto_minmax(0,1fr)_auto] items-start", wide ? "gap-y-2" : "gap-y-1")}>
      {thumb && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumb}
          alt=""
          style={{ viewTransitionName: PHOTO_TRANSITION }}
          className={clsx(
            "col-start-1 row-start-1 mr-4 size-18 shrink-0 rounded-control bg-surface-2 object-cover object-[50%_70%] ring-1 ring-line [@media(max-height:600px)]:size-14",
            wide ? "sm:row-span-2" : "row-span-2",
            NARROW_ONLY,
          )}
        />
      )}
      <div className="col-start-2 row-start-1 min-w-0">
        <StepTitle id={id}>{title}</StepTitle>
      </div>
      {aside && <div className="col-start-3 row-start-1 ml-4 flex">{aside}</div>}
      <div className={clsx("row-start-2 min-w-0", wide ? "col-span-3 col-start-1 max-w-read sm:col-span-2 sm:col-start-2" : "col-start-2")}>
        {lead ? (
          <div className={clsx(small ? "text-ui text-pretty text-muted" : "text-body text-pretty text-text-2")}>{lead}</div>
        ) : (
          <p aria-hidden="true" className="invisible text-ui">
            {"\u00a0"}
          </p>
        )}
      </div>
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
