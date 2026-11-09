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

/** A laptop screen tall enough (a 900px one and up) for Results to be a screen of its own (Proof.tsx). */
const TALL = 860;

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
  /** The screen's size. */
  size: { width: number; height: number };
  /** The page top, while `sel` is on the page. */
  top(sel: string): number | undefined;
  /** A point (0 to 1) on the pinned Chain of Custody's scroll, while the sequence is pinned. */
  beat(f: number): number | undefined;
  /** The beats a pinned runway lists for its own paging (data-scroll-stops: the phone sequence's), while it pins. */
  beats(sel: string): number[] | undefined;
  /** A point t on the Problem sheet's timeline (problemTimeline.ts), while the sheet is pinned. */
  sheet(t: number): number | undefined;
  /** The first visible match's top `under` px below the nav (LINE by default; -1 tucks a hairline under it). */
  line(sel: string, under?: number): number | undefined;
  /** The scrollY at which the first visible match has just gone under the nav. */
  past(sel: string): number | undefined;
  /** The scrollY that puts the first visible match's foot `at` of the way down the screen. */
  foot(sel: string, at: number): number | undefined;
  /** The page end, while `sel` is on the page. */
  end(sel: string): number | undefined;
  /** The clean frame nearest `prefer`: no line of text and no paper tag or console cut by the nav or the screen's foot. */
  fit(prefer: number | undefined, frame?: Frame): number | undefined;
};

export type Stop = {
  name: string;
  at: (page: Page) => number | readonly number[] | undefined;
  /** A story's inner beat, which a hard fling may skim past (gate.ts SKIM); a flick still stops on it. */
  inner?: true;
};

/**
 * The sections a frame is fitted to: their text, and their objects (the sheet's cards when it isn't pinned, the claims'
 * photos heading their lanes and the claims under each check on a narrow window, the tour's tabs and console, the
 * footer's tag).
 */
const TEXT = [
  "#checks header p, #checks h2, #checks [data-lanes-top] p, #checks [data-lanes-top] li > span:first-child, #checks ol > li h3, #checks ol > li p:not(.sr-only), #checks ol > li > ul > li, #checks [data-try-cta]",
  "#proof h2, #proof p, #proof dt, #proof dd",
  "#companies header p, #companies h2, #companies [role=tab], #companies [data-story] ~ div > *",
  "main ~ footer h2, main ~ footer p, main ~ footer li a",
].join(", ");
const OBJECTS = "#checks [data-lanes-top] img, #companies [role=tablist], #companies [data-step], #companies [data-cta] a, main ~ footer > div:first-child";
/** The Problem sheet's, only while it isn't pinned: pinned, its stage sticks, so its layout positions follow the scroll
 * and it is covered by Fraud checks wherever a section frame could meet it. */
const PROBLEM_TEXT = "#problem h2, #problem p:not(.sr-only)";
const PROBLEM_OBJECTS = "#problem [data-card]";
/** A check's heading and its text, kept together (the block less its 24px padding): never a heading alone at the foot. */
const GATE_TEXT = "#checks ol > li > div:first-child";

/** Check 3 of the laptop matrix (and of the phone list), and the first. */
const GATE_3 = "#checks ol > li:nth-child(3)";
const GATE_1 = "#checks ol > li:nth-child(1)";

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
  // Going up it stops on the same finished beats, as Page Up does, so a flick up never rests on a check half played. A
  // hard fling skims the beats between 01 and the console.
  ...PAGE_STOPS.slice(1).map((f, i, all) => ({ name: `Chain of Custody ${i + 1}`, at: (p: Page) => p.beat(f), ...(i > 0 && i < all.length - 1 && { inner: true as const }) })),
  // Laptops under 700px tall and windows under 1024px wide get the phone sequence: its chapters 01 and 02, then the
  // exhibit's beats, the stops its own Space and Page Down use (PhoneRunway).
  { name: "Chain of Custody, phone", at: (p) => p.beats("div[data-runway][data-scroll-stops]") },
  // Problem, pinned: the sheet open (where the nav's Problem lands), the loop closed with its sources printed, then cut,
  // the payoff printed and the lamp down. Each a hair before the next beat starts, so a whole pixel of rounding never
  // shows card 4 or the slash beginning. Not pinned (laptops under 700px tall), the sheet plays as it comes up: a stop
  // at its name, then its lower half whole, its foot from 78% of the screen up, past where the payoff has printed
  // (Problem.tsx).
  {
    name: "Problem, the sheet open",
    at: (p) => p.sheet(ANCHOR_AT - 0.4) ?? p.fit(p.line("#problem .eyebrow"), { min: p.line("#problem", 0), max: p.line("#problem .eyebrow", 16) }),
  },
  { name: "Problem, the loop closed", at: (p) => p.sheet(T.mark[0] - 0.4), inner: true },
  {
    name: "Problem, the loop cut",
    at: (p) => p.sheet(REST + 2) ?? p.fit(p.foot("#problem article", 0.78), { min: p.foot("#problem article", 0.8), max: p.foot("#problem article", 0.45) }),
  },
  // Fraud checks: the heading on the top line over the four claims and the checks that need no AI. Never so high that
  // the Problem sheet shows above the section's edge, and the heading at least 40px under the nav.
  {
    name: "Fraud checks",
    at: (p) => p.fit(p.line("#checks header"), { min: p.line("#checks", 0), max: p.line("#checks header", 40) }),
  },
  // Then check 3 to the rule and "Try to fool it", as the last lanes draw down to the checks the model reads and the
  // genuine claim is paid: check 3's hairline tucked under the nav, so it never reads as a second rule under it. On a
  // tall screen, as high as check 1's, so Results' heading stays below the fold.
  {
    name: "Fraud checks, the rule",
    at: (p) => p.fit(p.line(GATE_3, -1), { min: p.line(GATE_1, -1), before: "#proof header" }),
  },
  // Results: the heading, the zero and the footnote, For companies kept below the fold rather than cut by it. Never
  // showing the end of Fraud checks above it. On a laptop screen 860px tall and up the section is a screen of its own,
  // its content 18% of the screen down (Proof.tsx): its top goes straight under the nav, so it reads as one slide.
  {
    name: "Results",
    at: (p) =>
      p.size.height >= TALL && p.size.width >= 1024
        ? p.line("#proof", 0)
        : p.fit(p.line("#proof header"), { min: p.past("#checks [data-try-cta]"), before: "#companies header" }),
  },
  // For companies: the heading on the top line with the whole tour under it, wherever the console frame's foot still
  // clears the screen's foot from there (a tall screen); else the heading 24px under the nav, its eyebrow tucked under
  // it, where the frame still clears the foot (a 1440x900 laptop: ConsoleTour sizes the frame for this); else the tour
  // whole, its steps under the nav, never above the heading's foot. The heading is read whole with air above it, or is
  // wholly under the nav, never jammed against it. Phones and narrow windows, which get the story instead, stop at its
  // heading.
  {
    name: "For companies",
    at: (p) => {
      const head = p.line("#companies header");
      const frame = p.foot("#tour-panel", 1);
      if (head === undefined || frame === undefined) return head;
      if (head >= frame + 16) return p.fit(head);
      const h2 = p.line("#companies h2", 24)!;
      if (h2 >= frame + 8) return p.fit(h2, { min: frame + 8 });
      return p.fit(Math.max(p.line("#companies [data-tour]", 16)!, p.past("#companies h2")! + 8), { min: p.past("#companies h2") });
    },
  },
  // The footer's tag: "See a refund land in a minute." and Try a claim, at the page end; on a short screen, where the end
  // would cut the tag under the nav, the tag whole nearest the end (within half a screen of it).
  { name: "Footer", at: (p) => p.fit(p.end("footer"), { min: p.foot("main ~ footer", 1.5) }) },
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
/** The checks' hairlines (each check's top rule), and the air under one that the screen's foot keeps out of: closer, the
 * rule reads as a stray line along the foot (a 1920x1080 screen's Fraud checks frame left one 2px above it). */
const RULES = "#checks ol > li";
const RULE_AIR = 12;

/** The intervals a frame edge may not fall inside: each line's ink, each object with its shadow. An outcome not yet
 * printed (its lane armed, Pipeline.tsx) counts as printed, so a stop is the same frame whichever way the page came to
 * it (going up the lanes have drawn, going down they haven't). */
function atoms(sheet: boolean): [number, number][] {
  const out: [number, number][] = [];
  const add = (sel: string, grow: number) => {
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      if (!el.getClientRects().length) continue;
      const a = docTop(el) - grow;
      const b = docTop(el) + el.offsetHeight + grow;
      if (b > a) out.push([a, b]);
    }
  };
  add(TEXT, -INK);
  add(GATE_TEXT, -22);
  add(OBJECTS, AIR);
  if (sheet) {
    // The sheet lies tilted, which lifts or drops a card's corner by up to 13px off its layout box.
    add(PROBLEM_TEXT, -INK + 13);
    add(PROBLEM_OBJECTS, AIR + 13);
  }
  return out;
}

/**
 * The scrollY in [min, max] nearest `prefer` whose two edges (under the nav, the screen's foot) cut nothing, and at most
 * `cap` when a clean frame allows it. `foot` are boxes only the last edge (the screen's foot) may not fall in: the air
 * under a hairline, which would read as a stray rule along the screen's foot. When no clean frame fits the range, the
 * one that cuts least: an edge in a line's leading rather than through its words.
 */
export function nearestClean(
  prefer: number,
  boxes: readonly [number, number][],
  edges: readonly number[],
  { min = -Infinity, max = Infinity, cap = Infinity, foot = [] as readonly [number, number][] } = {},
) {
  const footEdge = edges[edges.length - 1];
  const pairs = [...boxes.flatMap((box) => edges.map((e) => [box, e] as const)), ...foot.map((box) => [box, footEdge] as const)];
  /** How deep the frame's edges go into whatever they cut, px: 0 for a clean frame. */
  const cut = (y: number) => {
    let worst = 0;
    for (const [[a, b], e] of pairs) worst = Math.max(worst, Math.min(y + e - a, b - y - e));
    return worst;
  };
  const inRange = [prefer, min, max, cap, ...pairs.flatMap(([[a, b], e]) => [a - e, b - e])].filter((y) => y >= min && y <= max);
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
    size: { width: innerWidth, height: innerHeight },
    top: (sel) => (document.querySelector(sel) ? 0 : undefined),
    beat: (f) => (runway ? runway.top + f * runway.travel : undefined),
    beats: (sel) => {
      const el = visible(sel);
      const rw = el && pinned(el);
      return rw ? el.dataset.scrollStops!.split(" ").map((f) => rw.top + Number(f) * rw.travel) : undefined;
    },
    // problemTimeline.ts: t is vh of scroll from the moment the section's top enters the foot of the screen.
    sheet: (t) => (problem ? problem.top - innerHeight + (t / 100) * innerHeight : undefined),
    line: (sel, under = LINE) => at(sel, (el) => framed(docTop(el), n, under)),
    past: (sel) => at(sel, (el) => docTop(el) + el.offsetHeight - n),
    foot: (sel, f) => at(sel, (el) => docTop(el) + el.offsetHeight - f * innerHeight),
    end: (sel) => (document.querySelector(sel) ? document.documentElement.scrollHeight - innerHeight : undefined),
    fit: (prefer, { min = 0, max = Infinity, before } = {}) => {
      if (prefer === undefined) return undefined;
      const cap = before ? at(before, (el) => docTop(el) - innerHeight) : undefined;
      // Never past the page's own ends, where the frame couldn't be.
      const limit = document.documentElement.scrollHeight - innerHeight;
      const foot = [...document.querySelectorAll<HTMLElement>(RULES)].filter((el) => el.getClientRects().length).map((el) => [docTop(el), docTop(el) + RULE_AIR] as [number, number]);
      return nearestClean(prefer, atoms(!problem), [n, innerHeight], { min: Math.max(0, min), max: Math.min(limit, max), cap, foot });
    },
  };
}

/** The pinned stretches as laid out now, [from, to] in scrollY: the Chain of Custody (the laptop's runway or the phone's)
 * and the Problem sheet, from where its top comes up into the screen and its first cards start to land
 * (problemTimeline.ts). Their stops are paced for the keys, however far apart (keys.ts), and the wheel never leaves the
 * page at rest inside one (gate.ts). */
export function pinnedStretches(): [number, number][] {
  const els = [visible("section[data-runway]"), visible("div[data-runway][data-scroll-stops]"), document.getElementById("problem")];
  return els.flatMap((el, i) => {
    const pin = pinned(el ?? null);
    return pin ? [[i === 2 ? pin.top - innerHeight : pin.top, pin.top + pin.travel] as [number, number]] : [];
  });
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
  return tidy(readAll(list, page).flat().filter(Number.isFinite), document.documentElement.scrollHeight - innerHeight);
}

/** The stops (the same going up as going down) and the slow stretches between them, read once when a gesture starts
 * (gate.ts). */
export function resolveCourse(): Course {
  const page = readPage();
  return {
    stops: resolveStops(STOPS, page),
    slow: readAll(SLOW, page),
    inner: resolveStops(STOPS.filter((s) => s.inner), page),
    pins: pinnedStretches(),
  };
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
  if (typeof y === "number") section.style.scrollMarginTop = `${docTop(section) - nav() - y}px`;
}
