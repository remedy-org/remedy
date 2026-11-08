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
 * The mark is a claim check: one evidence tag torn in two. The cream tag (45deg chamfers, a punched hole near its point)
 * stays with the destroyed product as the proof; the amber stub is the refund, lifting away at the stamp's -8deg.
 * Drawn on a 24 x 16 grid, so in the homepage nav (22px type, the mark 0.727em) one unit is one pixel. The tag fills
 * the full 16: cap height plus the overshoots. Its torn edge is six even 90deg teeth, 1.333 deep, peaks on x 13; the
 * stub is the same edge moved 2 right, then turned -8deg about its top corner, so the gap opens towards the foot and
 * its far corner rises 0.9 above the tag (the svg lets that overflow). The hole is cut out, so the page shows through,
 * and it sits small and near the point so hole and teeth never read as an eye and a mouth.
 * apple-icon.png and opengraph-image.tsx draw these paths. src/app/icon.svg redraws the mark for 16px on whole pixels
 * (it must stay comment-free: XML forbids a double hyphen in a comment, and a favicon that fails to parse shows
 * nothing): tag x2 to 9 and y4 to 12 with 2px chamfers, a 2px round-cornered hole, four 1px teeth, a 2px tear,
 * and the stub x10 to 14 whose top and foot climb 1px across it; the mark is centred on the tile, dark in both themes.
 *
 * Colours follow the theme through light-dark(), which reads the color-scheme each [data-theme] block sets:
 * dark: the tag is --paper, the stub --accent. Light: the tag is --ink-muted (it still reads as card, not a black
 * block) and the stub a deeper amber, because
 * --accent measures 2:1 on the light page; oklch(0.64 0.14 60) (#c8741d) measures 3.26:1 on --bg, 3.46:1 on
 * --surface and 3.09:1 on --surface-2 (WCAG graphics need 3:1). Override --mark-tag / --mark-stub to recolour it
 * (both currentColor for one colour: the tear carries the idea).
 */
const TAG =
  "M0 3.5L3.5 0H13L11.667 1.333L13 2.667L11.667 4L13 5.333L11.667 6.667L13 8L11.667 9.333L13 10.667L11.667 12L13 13.333L11.667 14.667L13 16H3.5L0 12.5ZM5.25 8A1.25 1.25 0 1 0 2.75 8A1.25 1.25 0 1 0 5.25 8Z";
const STUB =
  "M15 0L21.437 -0.905L23.664 14.94L17.227 15.844L15.721 14.709L16.856 13.204L15.35 12.069L16.485 10.563L14.979 9.428L16.113 7.922L14.607 6.787L15.742 5.281L14.236 4.147L15.371 2.641L13.865 1.506Z";

const markColours = {
  "--mark-tag": "light-dark(var(--ink-muted), var(--paper))",
  "--mark-stub": "light-dark(oklch(0.64 0.14 60), var(--accent))",
} as CSSProperties;

/** The mark alone, decorative. Size it with className (it is 3 : 2); the default is the wordmark's cap height. */
export function RemedyMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 16" aria-hidden="true" focusable="false" className={clsx("shrink-0 overflow-visible", className ?? "h-[0.727em] w-[1.09em]")} style={markColours}>
      <path fillRule="evenodd" fill="var(--mark-tag)" d={TAG} />
      <path fill="var(--mark-stub)" d={STUB} />
    </svg>
  );
}

/*
 * Lockup: Schibsted Grotesk (the site's sans) 600 at -0.025em. The tag is the cap height (0.703em) plus a 0.012em
 * overshoot above and below, so its top lines up with the R and its foot with the baseline (the stub's lifted corner
 * rises past the R on purpose); 0.3em from the name.
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
