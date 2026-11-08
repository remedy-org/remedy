// Where a fast wheel or trackpad fling comes to rest on the homepage, one stop per gesture (gate.ts lands it). This list
// is the one place to tune them. Every stop is read from the layout when a gesture starts, so fonts, the console preview
// loading or a resize never leave one off by a line, and a stop whose element is missing or hidden on this layout (a
// laptop-only tour on a narrow window, another page) simply isn't there.

import { HANDOFF, PAGE_STOPS } from "../custody/CustodyStage";
import { DOLLY } from "../custody/HeroRunway";
import { scrollAt } from "../custody/pace";
import { ANCHOR_AT, REST, T } from "../problemTimeline";
import type { Course } from "./gate";
import type { Slow } from "./landing";

/**
 * The top line: a section's eyebrow sits this far under the nav at its stop, the line the pinned stage's own eyebrows
 * sit on, so the stops frame to one line.
 */
export const LINE = 48;

/** What a frame may not cut, and where it may sit. */
export type Frame = {
  /** Never above this scrollY, nor below `max`. */
  min?: number;
  max?: number;
  /** Kept below the screen's foot whenever a clean frame allows it: the next section's heading. */
  before?: string;
};

/** Reads the page as laid out now; each helper returns undefined when its element isn't on this layout. */
export type Page = {
  /** The page top, while `sel` is on the page. */
  top(sel: string): number | undefined;
  /** A point (0 to 1) on the pinned Chain of Custody's scroll, while the sequence is pinned. */
  beat(f: number): number | undefined;
  /** A point t on the Problem sheet's timeline (problemTimeline.ts), while the sheet is pinned. */
  sheet(t: number): number | undefined;
  /** The first visible match's top `under` px below the nav (LINE by default; -1 tucks a hairline under it). */
  line(sel: string, under?: number): number | undefined;
  /** The scrollY at which the first visible match has just gone under the nav. */
  past(sel: string): number | undefined;
  /** The page end, while `sel` is on the page. */
  end(sel: string): number | undefined;
  /** The clean frame nearest `prefer`: no line of text and no paper tag or console cut by the nav or the screen's foot. */
  fit(prefer: number | undefined, frame?: Frame): number | undefined;
};

export type Stop = { name: string; at: (page: Page) => number | undefined };

/** Fraud checks, Results and For companies: their text, and their objects (the tags, the refund, the console). */
const TEXT = [
  "#checks header p, #checks h2, #checks [data-lanes-top] span, #checks ol > li h3, #checks ol > li p:not(.sr-only), #checks [data-try-cta]",
  "#proof h2, #proof p, #proof dt, #proof dd",
  "#companies header p, #companies h2, #companies [role=tab], #companies [data-story] ~ div > *",
].join(", ");
const OBJECTS = "#checks [data-tag], #checks div[aria-hidden][data-lane], #companies [data-step]";
/** A gate's heading and its text, kept together (the block less its 24px padding): never a heading alone at the foot. */
const GATE_TEXT = "#checks ol > li > div:first-child > div";

/** Gate 03 of the laptop pipeline (and of the phone list), and the one above it. */
const GATE_3 = "#checks ol > li:nth-child(3)";
const GATE_2 = "#checks ol > li:nth-child(2)";

/**
 * Top to bottom. Each stop is a whole frame: a beat at rest, never a transition half played, and nothing cut at either
 * edge. The glide into each one plays the transition before it (landing.ts paces it).
 */
export const STOPS: readonly Stop[] = [
  // The hero at rest, its laptop's checks ticked and the payout landed.
  { name: "Hero", at: (p) => p.top("[aria-labelledby='hero-title']") },
  // The Chain of Custody: the stops Space and Page Down use in the pin (CustodyStage), so the keys and the wheel stop on
  // the same beats: 01 and 02 with every line lit, the exhibit's live photo and five checks at their holds, the paid
  // receipt, then the console. Its first stop is the runway's top, the page top.
  ...PAGE_STOPS.slice(1).map((f, i) => ({ name: `Chain of Custody ${i + 1}`, at: (p: Page) => p.beat(f) })),
  // Problem, pinned: the sheet open (where the nav's Problem lands), the loop closed with its sources printed, then cut,
  // the payoff printed and the lamp down. Each a hair before the next beat starts, so a whole pixel of rounding never
  // shows card 4 or the slash beginning. Not pinned, the sheet plays as it comes up: one stop at its name.
  { name: "Problem, the sheet open", at: (p) => p.sheet(ANCHOR_AT - 0.4) ?? p.line("#problem .eyebrow") },
  { name: "Problem, the loop closed", at: (p) => p.sheet(T.mark[0] - 0.4) },
  { name: "Problem, the loop cut", at: (p) => p.sheet(REST + 2) },
  // Fraud checks: the heading on the top line over the gates that need no AI, their tags dropped. Never so high that
  // the Problem sheet shows above the section's edge, and the heading at least 16px under the nav.
  {
    name: "Fraud checks",
    at: (p) => p.fit(p.line("#checks header"), { min: p.line("#checks", 0), max: p.line("#checks header", 16) }),
  },
  // Then gate 03 to the rule and "Try to fool it", as the model's samples drop and the refund is paid: gate 03's hairline
  // tucked under the nav, so it never reads as a second rule under it. On a tall screen, gate 02's, so Results' heading
  // stays below the fold.
  {
    name: "Fraud checks, the rule",
    at: (p) => p.fit(p.line(GATE_3, -1), { min: p.line(GATE_2, -1), before: "#proof header" }),
  },
  // Results: the heading, the zero and the footnote, For companies kept below the fold rather than cut by it (on a tall
  // screen, its heading and tabs whole under Results). Never showing the end of Fraud checks above it.
  {
    name: "Results",
    at: (p) => p.fit(p.line("#proof header"), { min: p.past("#checks [data-try-cta]"), before: "#companies header" }),
  },
  // For companies: the tour whole, its tabs 16px under the nav and the console frame under them (the frame is sized to
  // fit this, home.module.css .stage). Phones and narrow windows, which get the story instead, stop at its heading.
  { name: "For companies", at: (p) => p.fit(p.line("#companies [data-tour]", 16) ?? p.line("#companies header")) },
  // The footer's tag: "See a refund land in a minute." and Try a claim, at the page end.
  { name: "Footer", at: (p) => p.end("footer") },
];

/**
 * The pinned transitions a glide crosses slowly, each `weight` times slower than the way around it (landing.ts warp), so
 * a fling sees them play rather than flash by: measured on the glide at 1440x900, each now takes about half a second.
 * Pinned, the screen holds still between beats, so the change of pace never shows as a change of scroll speed.
 */
export const SLOW: readonly { name: string; at: (page: Page) => Slow | undefined }[] = [
  // The hero's laptop dollies in until its screen is the stage, and hands over to chapter 01 (0.22 s on a plain glide).
  { name: "The dolly", at: (p) => span(p.beat(scrollAt(DOLLY[0])), p.beat(scrollAt(HANDOFF[1])), 5) },
  // The sheet lands its first cards and unfolds, as the page settles on it.
  { name: "The sheet opens", at: (p) => span(p.sheet(T.card1[0]), p.sheet(T.card3[1]), 2) },
  // Card 4 lands and the string closes the loop back to card 1 (0.1 s and 0.2 s on a plain glide).
  { name: "The loop closes", at: (p) => span(p.sheet(T.card4[0]), p.sheet(T.ring[1]), 3) },
  // The slash is drawn and the string snaps (0.1 s each on a plain glide).
  { name: "The loop is cut", at: (p) => span(p.sheet(T.mark[0]), p.sheet(T.snip[1]), 4) },
];

/** A slow stretch from two positions, either of which may be missing. */
function span(a: number | undefined, b: number | undefined, weight: number): Slow | undefined {
  return a === undefined || b === undefined ? undefined : [a, b, weight];
}

/**
 * Sections whose anchor (the nav, the footer, the skip links) lands where their first fling stop frames them, read at
 * the moment an anchor is followed (alignAnchor), so the anchor and the fling never land a few lines apart on the same
 * section. Problem's lands on the open sheet at ANCHOR_AT exactly (its CSS margin alone left out the nav's 4rem, so it
 * landed with card 3 half down). For companies' lands on its heading, which its stop leaves above the tour.
 */
export const ANCHORED: Readonly<Record<string, string>> = { problem: "Problem, the sheet open", checks: "Fraud checks", proof: "Results" };

/** Stops closer than this are one stop, the first kept: the pinned runway's own start, 64px down, is the page top. */
export const MERGE = 80;

// ------------------------------------------------------------------------------------------------ Pure.

/** The scrollY that puts an element whose document top is `top` exactly `under` px below a `nav`-tall nav. */
export const framed = (top: number, nav: number, under: number) => top - nav - under;

/** Stop positions as the gate reads them: whole px inside the page's scroll range, sorted, near-duplicates merged. */
export function tidy(ys: readonly number[], limit: number, merge = MERGE): number[] {
  const sorted = ys.map((y) => Math.round(Math.min(limit, Math.max(0, y)))).sort((a, b) => a - b);
  const out: number[] = [];
  for (const y of sorted) if (!out.length || y - out[out.length - 1] >= merge) out.push(y);
  return out;
}

// ------------------------------------------------------------------------------------------------ Reading the page.

/** The 4rem nav. */
const nav = () => 4 * parseFloat(getComputedStyle(document.documentElement).fontSize);

/** An element's top in the document from layout (offsetTop), so an entrance's transform (Reveal) never moves a stop. */
function docTop(el: HTMLElement) {
  let y = 0;
  for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) y += n.offsetTop;
  return y;
}

/** The first match with a box on this layout: display: none (the laptop-only tour on a phone) has none. */
const visible = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)].find((el) => el.getClientRects().length);

/** A section that pins (one of its children sticks) and runs longer than the screen: its top and scroll travel. */
function pinned(el: HTMLElement | null) {
  if (!el) return null;
  const travel = el.offsetHeight - innerHeight;
  if (travel <= 0 || ![...el.children].some((c) => getComputedStyle(c).position === "sticky")) return null;
  return { top: docTop(el), travel };
}

/** A line box's ink can start this close to its edge (a 14px line's ascenders, 3px in): a frame edge keeps out of the
 * rest. */
const INK = 2;
/** Air a paper object (a tag, the console) keeps from the nav and the screen's foot: its shadow. */
const AIR = 8;

/** The intervals a frame edge may not fall inside: each line's ink, each object with its shadow. Tags not yet dropped
 * (their lane armed, Pipeline.tsx) are not there. */
function atoms(): [number, number][] {
  const out: [number, number][] = [];
  const add = (sel: string, grow: number) => {
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      if (!el.getClientRects().length || el.closest("[data-go='armed']")) continue;
      const a = docTop(el) - grow;
      const b = docTop(el) + el.offsetHeight + grow;
      if (b > a) out.push([a, b]);
    }
  };
  add(TEXT, -INK);
  add(GATE_TEXT, -22);
  add(OBJECTS, AIR);
  return out;
}

/**
 * The scrollY in [min, max] nearest `prefer` whose two edges (under the nav, the screen's foot) cut nothing, and at most
 * `cap` when a clean frame allows it. When no clean frame fits the range, the one that cuts least: an edge in a line's
 * leading rather than through its words.
 */
export function nearestClean(prefer: number, boxes: readonly [number, number][], edges: readonly number[], { min = -Infinity, max = Infinity, cap = Infinity } = {}) {
  /** How deep the frame's edges go into whatever they cut, px: 0 for a clean frame. */
  const cut = (y: number) => {
    let worst = 0;
    for (const [a, b] of boxes) for (const e of edges) worst = Math.max(worst, Math.min(y + e - a, b - y - e));
    return worst;
  };
  const inRange = [prefer, min, max, cap, ...boxes.flatMap(([a, b]) => edges.flatMap((e) => [a - e, b - e]))].filter((y) => y >= min && y <= max);
  const nearest = (ys: number[]) => ys.reduce<number | undefined>((best, y) => (best === undefined || Math.abs(y - prefer) < Math.abs(best - prefer) ? y : best), undefined);
  const clean = inRange.filter((y) => cut(y) <= 0);
  if (clean.length) return nearest(clean.filter((y) => y <= cap)) ?? nearest(clean)!;
  const least = Math.min(...inRange.map(cut));
  return nearest(inRange.filter((y) => cut(y) === least)) ?? prefer;
}

/** The page as laid out now. */
export function readPage(): Page {
  const n = nav();
  const runway = pinned(document.querySelector<HTMLElement>("section[data-runway]"));
  const problem = pinned(document.getElementById("problem"));
  const at = (sel: string, f: (el: HTMLElement) => number) => {
    const el = visible(sel);
    return el ? f(el) : undefined;
  };
  return {
    top: (sel) => (document.querySelector(sel) ? 0 : undefined),
    beat: (f) => (runway ? runway.top + f * runway.travel : undefined),
    // problemTimeline.ts: t is vh of scroll from the moment the section's top enters the foot of the screen.
    sheet: (t) => (problem ? problem.top - innerHeight + (t / 100) * innerHeight : undefined),
    line: (sel, under = LINE) => at(sel, (el) => framed(docTop(el), n, under)),
    past: (sel) => at(sel, (el) => docTop(el) + el.offsetHeight - n),
    end: (sel) => (document.querySelector(sel) ? document.documentElement.scrollHeight - innerHeight : undefined),
    fit: (prefer, { min, max, before } = {}) => {
      if (prefer === undefined) return undefined;
      const cap = before ? at(before, (el) => docTop(el) - innerHeight) : undefined;
      return nearestClean(prefer, atoms(), [n, innerHeight], { min, max, cap });
    },
  };
}

const warned = new Set<string>();

/** Each entry's value on this page; one that can't be read is skipped, never thrown inside Lenis's wheel callback. */
function readAll<V>(list: readonly { name: string; at: (page: Page) => V | undefined }[], page: Page): V[] {
  const out: V[] = [];
  for (const s of list) {
    try {
      const v = s.at(page);
      if (v !== undefined) out.push(v);
    } catch (e) {
      if (process.env.NODE_ENV !== "production" && !warned.has(s.name)) {
        warned.add(s.name);
        console.warn(`Scroll stop "${s.name}" failed`, e);
      }
    }
  }
  return out;
}

/** The stops as scrollY values for the page as laid out now. */
export function resolveStops(list: readonly Stop[] = STOPS, page = readPage()): number[] {
  return tidy(readAll(list, page).filter(Number.isFinite), document.documentElement.scrollHeight - innerHeight);
}

/** The stops and the slow stretches between them, read once when a gesture starts (gate.ts). */
export function resolveCourse(): Course {
  const page = readPage();
  return { stops: resolveStops(STOPS, page), slow: readAll(SLOW, page) };
}

/**
 * Before the browser follows a same-page link to one of the ANCHORED sections, sets that section's scroll-margin-top
 * so it lands on the frame its fling stop gives it. The jump itself stays native (focus, the hash, the skip links).
 */
export function alignAnchor(hash: string) {
  const id = decodeURIComponent(hash.slice(1));
  const stop = STOPS.find((s) => s.name === ANCHORED[id]);
  const section = document.getElementById(id);
  if (!stop || !section) return;
  const y = stop.at(readPage());
  // html's scroll-padding-top (the nav) and the section's margin together put its top at y.
  if (y !== undefined) section.style.scrollMarginTop = `${docTop(section) - nav() - y}px`;
}
