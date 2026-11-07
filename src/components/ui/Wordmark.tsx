import clsx from "clsx";
import type { CSSProperties } from "react";
import Link from "next/link";

export interface WordmarkProps {
  /** sm for app chrome (body-size type), md for the homepage nav and footer (lead-size type). */
  size?: "sm" | "md";
  /** Wrap in a link, usually "/". */
  href?: string;
  className?: string;
  /** On the name only, e.g. to hide it visually where a header has no room (the link keeps its label). */
  nameClassName?: string;
}

/*
 * The mark is a claim check: one tag torn in two. The tag (punched hole, 45deg chamfers) stays on the destroyed
 * product as the proof; the amber stub is the refund the owner keeps. Drawn 21 x 14 units: tag 12, a straight 1.5
 * tear, stub 7.5 (8 : 5, the same split as the 16px favicon), one r1.6 notch on each long edge biting both halves.
 * The hole is cut out, so the page shows through. apple-icon.png and opengraph-image.tsx draw the same geometry.
 * src/app/icon.svg redraws it for 16px on whole pixels (it must stay comment-free: XML forbids a double hyphen in a
 * comment, and a favicon that fails to parse shows nothing): tag x1 to 8 with 2px chamfers and a 3px hole, a 2px
 * tear, and the stub x10 to 15 with a 1px zig-zag on its torn edge, on the dark bg tile in both browser themes.
 *
 * Colours follow the theme through light-dark(), which reads the color-scheme each [data-theme] block sets:
 * dark: the tag is --paper, the stub --accent. Light: the tag is --ink-muted (it still reads as card, not a black
 * block) and the stub a deeper amber, because
 * --accent measures 2:1 on the light page; oklch(0.64 0.14 60) (#c8741d) measures 3.26:1 on --bg, 3.46:1 on
 * --surface and 3.09:1 on --surface-2 (WCAG graphics need 3:1). Override --mark-tag / --mark-stub to recolour it.
 */
const TAG = "M0 3L3 0H11.15A1.6 1.6 0 0 0 12 1.413V12.587A1.6 1.6 0 0 0 11.15 14H3L0 11ZM5 7A1.25 1.25 0 1 0 2.5 7A1.25 1.25 0 1 0 5 7Z";
const STUB = "M14.35 0H20A1 1 0 0 1 21 1V13A1 1 0 0 1 20 14H14.35A1.6 1.6 0 0 0 13.5 12.587V1.413A1.6 1.6 0 0 0 14.35 0Z";

const markColours = {
  "--mark-tag": "light-dark(var(--ink-muted), var(--paper))",
  "--mark-stub": "light-dark(oklch(0.64 0.14 60), var(--accent))",
} as CSSProperties;

/** The mark alone, decorative. Size it with className (it is 3 : 2); the default is the wordmark's cap height. */
export function RemedyMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 21 14" aria-hidden="true" focusable="false" className={clsx("shrink-0", className ?? "h-[0.727em] w-[1.09em]")} style={markColours}>
      <path fillRule="evenodd" fill="var(--mark-tag)" d={TAG} />
      <path fill="var(--mark-stub)" d={STUB} />
    </svg>
  );
}

/*
 * Lockup: Schibsted Grotesk (the site's sans) 600 at -0.025em. The mark is the cap height (0.703em) plus a 0.012em
 * overshoot above and below, so its top lines up with the R and its foot with the baseline; 0.3em from the name.
 */
export function Wordmark({ size = "sm", href, className, nameClassName }: WordmarkProps) {
  const body = (
    <span
      className={clsx(
        "inline-flex items-baseline gap-[0.3em] font-semibold tracking-[-0.025em] text-text",
        size === "md" ? "text-lead" : "text-body",
        className,
      )}
    >
      <RemedyMark className="relative top-[0.012em] h-[0.727em] w-[1.09em]" />
      {nameClassName ? <span className={nameClassName}>Remedy</span> : "Remedy"}
    </span>
  );
  if (!href) return body;
  return (
    <Link href={href} aria-label="Remedy, home" className="inline-flex min-h-11 min-w-11 items-center rounded-control">
      {body}
    </Link>
  );
}
