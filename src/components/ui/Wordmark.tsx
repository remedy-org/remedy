import clsx from "clsx";
import type { CSSProperties } from "react";
import Link from "next/link";
import { MARK_STUB, MARK_TAG } from "./markPaths";

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
 * The master (markPaths.ts) is drawn on a 24 x 16 grid. The tag fills the full 16: the cap height plus overshoots. Its
 * torn edge is six even 90deg teeth, 1.333 deep on a 2.667 pitch, peaks on x 13. The stub's torn edge is the same edge
 * moved 2 right and never turned, so the two halves of the tear stay identical and the gap stays an even 2 (a turned
 * edge opened into a wedge that read as a lightning bolt at icon size). Its outer sides are skewed -8deg about x 15: a
 * parallelogram 8 wide whose top and foot stay parallel, rising 1.12 to its upright far edge (the svg lets that
 * overflow), so it lifts as rigid paper rather than flaring into a keystone. The hole is cut out, so the page shows
 * through, and it sits small and near the point so hole and teeth never read as an eye and a mouth.
 *
 * The teeth sit on thirds of a unit, so they are crisp from 2x. Below that a 45deg tooth one pixel deep averages to a
 * grey seam, so the two sizes the site uses have hinted drawings on whole pixels, shown below 1.5dppx: 24 x 16 (md,
 * the homepage nav and footer, one unit per pixel) and 18 x 12 (sm, app chrome). Their tear is a crenellation that
 * steps one pixel each row with a 2px gap, the stub's edge offset to match, so it survives as a crisp zigzag. Any
 * RemedyMark sized h-4 w-6 or h-3 w-[1.125rem] gets them; other sizes draw the master. Both lockup sizes are whole
 * pixels (24 x 16 and 18 x 12), so the edges land on the pixel grid.
 * opengraph-image.tsx draws the master, and scripts/apple-icon.ts renders it into apple-icon.png (run it after any
 * change to markPaths.ts). src/app/icon.svg is its own drawing on a 32 grid (it must stay comment-free: XML forbids a
 * double hyphen in a comment, and a favicon that fails to parse shows nothing). An SVG image's media queries see its
 * own width (resolution queries never match inside one, in Chromium or WebKit), so it carries three drawings: a 16px
 * one on whole pixels (four crenellated teeth and a flat stub on the tag's own rows 4 to 12, so the art is centred on
 * the tile; no hole, since a dot in a 7px tag reads as an eye, and no lift, since 8deg is 0.7px across the stub and a
 * 1px step read as a notch), the 24 x 16 hinted drawing from 24px (a 2x tab, when the browser rasterises the icon at
 * 32), and the master from 48px. Cream and amber on the dark in both themes.
 *
 * Colours follow the theme through light-dark(), which reads the color-scheme each [data-theme] block sets:
 * dark: the tag is --paper, the stub --accent. Light: the tag is --text, the same ink as the name beside it (a lighter
 * grey read as disabled), and the stub a deeper amber, because --accent measures 2:1 on the light page;
 * oklch(0.64 0.14 60) (#c8741d) measures 3.26:1 on --bg, 3.46:1 on --surface and 3.09:1 on --surface-2 (WCAG graphics
 * need 3:1). Override --mark-tag / --mark-stub to recolour it (both currentColor for one colour: the tear carries it).
 */
const markColours = {
  "--mark-tag": "light-dark(var(--text), var(--paper))",
  "--mark-stub": "light-dark(oklch(0.64 0.14 60), var(--accent))",
} as CSSProperties;

// The hinted drawings, one unit per pixel. 24 x 16: the master's outline with the crenellated tear (peaks x 13, valleys
// x 12, the stub's edge 2 to the right), the master's hole and its stub, whose far edge sits on x 23. 18 x 12: the
// master at 0.75, snapped (tag to x 10, a 3px chamfer, a 2px hole centred on a pixel corner, the stub from x 11/12 to an
// upright far edge on x 18, rising 0.84). Both far edges land on whole pixels, so only the slanted top and foot blur.
const HINTED = {
  16: {
    tag: "M3.5 0H13V1H12V2H13V3H12V4H13V5H12V6H13V7H12V8H13V9H12V10H13V11H12V12H13V13H12V14H13V15H12V16H3.5L0 12.5V3.5ZM5.25 8A1.25 1.25 0 1 0 2.75 8A1.25 1.25 0 1 0 5.25 8Z",
    stub: "M15 0L23 -1.124V14.876L15 16H14V15H15V14H14V13H15V12H14V11H15V10H14V9H15V8H14V7H15V6H14V5H15V4H14V3H15V2H14V1H15Z",
  },
  12: {
    tag: "M3 0H10V1H9V2H10V3H9V4H10V5H9V6H10V7H9V8H10V9H9V10H10V11H9V12H3L0 9V3ZM4 6A1 1 0 1 0 2 6A1 1 0 1 0 4 6Z",
    stub: "M12 0L18 -0.843V11.157L12 12H11V11H12V10H11V9H12V8H11V7H12V6H11V5H12V4H11V3H12V2H11V1H12Z",
  },
} as const;

const has = (className: string, token: string) => className.split(/\s+/).includes(token);
/** The hinted grid for a whole-pixel size, else null. */
function pixelGrid(className?: string): 16 | 12 | null {
  if (!className) return null;
  if (has(className, "h-4") && has(className, "w-6")) return 16;
  if (has(className, "h-3") && has(className, "w-[1.125rem]")) return 12;
  return null;
}

/** The mark alone, decorative. Size it with className (it is 3 : 2); the default is the wordmark's cap height. */
export function RemedyMark({ className }: { className?: string }) {
  const grid = pixelGrid(className);
  const hinted = grid ? HINTED[grid] : null;
  return (
    <svg viewBox="0 0 24 16" aria-hidden="true" focusable="false" className={clsx("shrink-0 overflow-visible", className ?? "h-[0.727em] w-[1.09em]")} style={markColours}>
      {hinted ? (
        <g className="[@media(min-resolution:1.5dppx)]:hidden" transform={grid === 12 ? "scale(1.3333333)" : undefined}>
          <path fillRule="evenodd" fill="var(--mark-tag)" d={hinted.tag} />
          <path fill="var(--mark-stub)" d={hinted.stub} />
        </g>
      ) : null}
      <g className={hinted ? "hidden [@media(min-resolution:1.5dppx)]:inline" : undefined}>
        <path fillRule="evenodd" fill="var(--mark-tag)" d={MARK_TAG} />
        <path fill="var(--mark-stub)" d={MARK_STUB} />
      </g>
    </svg>
  );
}

/*
 * Lockup: Schibsted Grotesk (the site's sans) 600 at -0.025em, the mark 0.25em from the name (the stub's lean already
 * opens the gap at the cap line). The mark is sized in whole pixels so the grid lands on device pixels: md 24 x 16 at
 * 22px type (the cap height, 15.5px, plus the overshoots; its box starts 0.05px off a whole pixel in the nav), sm
 * 18 x 12 at 17px (the cap height, 11.95px). Its foot sits on the baseline; sm's baseline falls 0.828px into a pixel
 * row, so the sm mark drops 0.172px to start on a whole one (its foot 0.17px under the baseline, an overshoot).
 */
export function Wordmark({ size = "sm", href, className, nameClassName }: WordmarkProps) {
  const body = (
    <span
      className={clsx(
        "inline-flex items-baseline gap-[0.25em] font-semibold tracking-[-0.025em] text-text",
        size === "md" ? "text-lead" : "text-body",
        className,
      )}
    >
      <RemedyMark className={size === "md" ? "h-4 w-6" : "relative top-[0.172px] h-3 w-[1.125rem]"} />
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
