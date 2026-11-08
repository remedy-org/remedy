"use client";

import clsx from "clsx";
import { Tinos } from "next/font/google";
import { useCallback, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode, type Ref } from "react";
import { SkipLink, Stamp } from "@/components/ui";
import s from "./problem.module.css";
import { clamp, dash, inOutQuart, outExpo, outQuart, PAYOFF_LEAD, PAYOFF_REST, piecewise, REST, seg, stampScale, T } from "./problemTimeline";

/*
 * Exhibit A: one aged evidence sheet on the dark desk. On a laptop (at least 1024 x 700, motion allowed) it rises out
 * of the dark folded in half, the lower half swings down like a map opening, four cards land on brass pins, one red
 * string closes the loop between them, a bold slash marks where Remedy steps in, the string snaps and its ends recoil
 * and fall while "Remedy cuts the loop." prints under the cut, then the lamp narrows to a pool on it. Section B then
 * scrolls over the held sheet like a page laid on top. Every beat is scrubbed by the scroll (problemTimeline.ts), so
 * fast and slow readers, and readers scrolling back, all see the same frame.
 *
 * Architecture after the "unfold" prototype: one function maps scroll to t and writes CSS custom properties; each
 * property defaults to the finished sheet, so no JS and reduced motion get it open, pinned, cut and paid off. The
 * fold is hand-built CSS 3D (a hinge at half height, its face a window onto a second copy of the paper), after Thomas
 * Park's folding map and oriDomi's clone-and-shade idea (dmotz, MIT; technique only, no code). A library would add
 * weight for one hinge.
 *
 * Phones and short laptops get the open sheet with the cards stacked; each card lands as it reaches the reader and
 * stays landed (the timeline only runs forward until the section is below the screen again). The chain runs down the
 * margin with no return line (card 4 says "Back to 01"); the cut is a slash and a stamp in the gap above card 4, and
 * the payoff prints at the sheet's foot only once the cut has happened.
 *
 * Facts from IDEA.md §2.2, each marked VERIFIED there: PIRG's 6-10% ("returned or discarded"); our CPSC recalls API
 * pull for 1 Oct to 5 Nov 2026 (36 refund recalls, 27 ask for a photo, 20 of those have owners email it to an
 * inbox); the Kikea nursing-pillow notice, CPSC 27-071; and the CPSC's request for information CPSC-2026-0067, which
 * names "artificially generated images" and warns fraud controls "reduce recall participation".
 */

// Card 3 quotes the Federal Register in a Times face: Tinos (Apache 2.0), metric-compatible with Times New Roman, so
// the facsimile looks the same on every system. Only these three words use it, and it is not preloaded.
const facsimile = Tinos({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  preload: false,
  fallback: ["Times New Roman", "Times", "serif"],
});

const SOURCES = [
  {
    label: "PIRG, Too Much to Recall, Jan 2024",
    href: "https://publicinterestnetwork.org/wp-content/uploads/2024/01/TOO-MUCH-TO-RECALL-FINAL-1-11-1.pdf",
  },
  {
    label: "CPSC recalls API, 1 Oct–5 Nov 2026",
    href: "https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallDateStart=2026-10-01&RecallDateEnd=2026-11-05",
  },
  {
    label: "CPSC 27-071",
    href: "https://www.cpsc.gov/Recalls/2027/Kikea-Store-Recalls-X-VESOLJE-Nursing-Pillows-Due-to-Risk-of-Serious-Injury-or-Death-from-Suffocation-Violate-Mandatory-Standards-for-Nursing-Pillows",
  },
  {
    label: "CPSC-2026-0067",
    href: "https://public-inspection.federalregister.gov/2026-07328.pdf",
  },
];

/* ---------- geometry ---------- */

type Pt = [number, number];
/** Pins, the list's size, and where along span 3 (0 to 1) the cut falls: the middle on the board, the gap above card 4 when stacked. */
type Geo = { pts: Pt[]; w: number; h: number; stacked: boolean; cutU: number };
const SPANS = ["span1", "span2", "cutA", "cutB", "ret"] as const;
type Span = (typeof SPANS)[number];
/** An arrowhead at the end of each span, so the loop reads as cause and effect: span 1 into card 2, ... the return into card 1. */
const HEADS = ["span1", "span2", "span3", "ret"] as const;
type Head = (typeof HEADS)[number];

/** One slack span: a quadratic whose control point is the midpoint pushed `sag` of the span's length along `dir`. */
function quad(a: Pt, b: Pt, dir: Pt, sag: number): [Pt, Pt, Pt] {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return [a, [(a[0] + b[0]) / 2 + dir[0] * len * sag, (a[1] + b[1]) / 2 + dir[1] * len * sag], b];
}
const f1 = (n: number) => n.toFixed(1);
const qd = ([a, c, b]: [Pt, Pt, Pt]) => `M${f1(a[0])},${f1(a[1])} Q${f1(c[0])},${f1(c[1])} ${f1(b[0])},${f1(b[1])}`;
const lerp = (a: Pt, b: Pt, u: number): Pt => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
const unit = (a: Pt, b: Pt): Pt => {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
};

/** An open chevron whose tip sits just outside the pin at `end`, pointing along `dir`. */
function head(end: Pt, dir: Pt, size = 1): string {
  const tip: Pt = [end[0] - dir[0] * 8, end[1] - dir[1] * 8];
  const back: Pt = [tip[0] - dir[0] * 6.5 * size, tip[1] - dir[1] * 6.5 * size];
  const n: Pt = [-dir[1] * 3.6 * size, dir[0] * 3.6 * size];
  return `M${f1(back[0] + n[0])},${f1(back[1] + n[1])} L${f1(tip[0])},${f1(tip[1])} L${f1(back[0] - n[0])},${f1(back[1] - n[1])}`;
}

/** The loop's spans in eye-path order, their arrowheads, and the cut. Span 3 (the faked photo to the fraud checks) comes as two halves so it can be cut. */
function loopPaths({ pts, stacked, cutU }: Geo) {
  const [p1, p2, p3, p4] = pts;
  const centre: Pt = [(p1[0] + p2[0] + p3[0] + p4[0]) / 4, (p1[1] + p2[1] + p3[1] + p4[1]) / 4];
  // On the board, level spans sag 7% and steep ones bow toward the loop's middle, away from the cards' text. Stacked,
  // the chain runs down the margin nearly straight.
  const dirFor = (a: Pt, b: Pt): Pt => {
    if (stacked) return [1, 0];
    if (Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1])) return [0, 1];
    return [Math.sign(centre[0] - (a[0] + b[0]) / 2) || 1, 0];
  };
  const sag = stacked ? 0.015 : 0.07;
  const s1 = quad(p1, p2, dirFor(p1, p2), sag);
  const s2 = quad(p2, p3, dirFor(p2, p3), sag);
  const [a, c, b] = quad(p3, p4, dirFor(p3, p4), sag);
  // Split at the cut (de Casteljau): half A runs from card 3's pin to the cut, half B from card 4's pin to it.
  const ac = lerp(a, c, cutU);
  const cb = lerp(c, b, cutU);
  const mid = lerp(ac, cb, cutU);
  // On the board the return bows well into the loop's middle, so it reads as an arc closing the ring, not a hop.
  // Stacked there is no return line (it ran beside the chain as a double rule); card 4 says "Back to 01" instead.
  // At least 36px of bow, so even a short return (narrow boards, where card 1 runs tall) still reads as an arc.
  const r = quad(p4, p1, dirFor(p4, p1), Math.max(0.3, 36 / (Math.hypot(p1[0] - p4[0], p1[1] - p4[1]) || 1)));
  const ret = stacked ? "" : qd(r);
  // The cut mark: a bold slash across the span at the cut, turned 60deg from the string.
  const tan = unit(ac, cb);
  const k = Math.PI / 3;
  const sd: Pt = [tan[0] * Math.cos(k) - tan[1] * Math.sin(k), tan[0] * Math.sin(k) + tan[1] * Math.cos(k)];
  const half = stacked ? 14 : 22;
  const slash = `M${f1(mid[0] - sd[0] * half)},${f1(mid[1] - sd[1] * half)} L${f1(mid[0] + sd[0] * half)},${f1(mid[1] + sd[1] * half)}`;
  const hs = stacked ? 1.5 : 1;
  const heads: Record<Head, string> = {
    span1: head(p2, unit(s1[1], p2), hs),
    span2: head(p3, unit(s2[1], p3), hs),
    span3: head(p4, unit(c, p4), hs),
    ret: stacked ? "" : head(p1, unit(r[1], p1)),
  };
  const spans: Record<Span, string> = {
    span1: qd(s1),
    span2: qd(s2),
    cutA: qd([a, ac, mid]),
    cutB: qd([b, cb, mid]),
    ret,
  };
  // Each half's rough length, so the snap can pull each end back a fixed distance from the cut.
  const lens = [Math.hypot(mid[0] - a[0], mid[1] - a[1]), Math.hypot(mid[0] - b[0], mid[1] - b[1])];
  return { spans, heads, slash, mid, lens };
}

/** The ring round 6-10%: a loose hand-drawn oval, 1.1 turns, its end overshooting outward, tilted 4deg, in 100 x 40. */
const RING = (() => {
  const pts: Pt[] = [];
  const n = 16;
  const tilt = (-4 * Math.PI) / 180;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const a = -0.5 - k * Math.PI * 2 * 1.1;
    const g = 0.97 + 0.07 * k;
    const x = 46 * g * Math.cos(a);
    const y = 17.5 * g * Math.sin(a);
    pts.push([50 + x * Math.cos(tilt) - y * Math.sin(tilt), 20 + x * Math.sin(tilt) + y * Math.cos(tilt)]);
  }
  // Catmull-Rom through the points, as cubics.
  let d = `M${f1(pts[0][0])},${f1(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n, i + 2)];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f1(c1[0])},${f1(c1[1])} ${f1(c2[0])},${f1(c2[1])} ${f1(p2[0])},${f1(p2[1])}`;
  }
  return d;
})();

/* ---------- modes ---------- */

type Mode = "pin" | "play" | "still";
const PIN_Q = "(min-width: 1024px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)";
const REDUCED_Q = "(prefers-reduced-motion: reduce)";
const BOARD_Q = "(min-width: 1024px)";

function useMedia(query: string) {
  return useSyncExternalStore(
    (notify) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", notify);
      return () => m.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
const noSubscribe = () => () => {};
const useHydrated = () =>
  useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );

/* ---------- the parts ---------- */

function Loop({ geo, ref, blur }: { geo: Geo; ref: Ref<SVGSVGElement>; blur: string }) {
  const { spans, heads, slash } = loopPaths(geo);
  return (
    <svg ref={ref} className={s.string} viewBox={`0 0 ${geo.w} ${geo.h}`} aria-hidden="true">
      <defs>
        <filter id={blur} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="1.1" />
        </filter>
      </defs>
      {SPANS.map((k) => (
        <g key={k} data-cut={k === "cutA" ? "a" : k === "cutB" ? "b" : undefined}>
          {/* The string's shadow on the paper, then the string. */}
          <path data-span={k} d={spans[k]} pathLength={1} className={s.threadShadow} filter={`url(#${blur})`} />
          <path data-span={k} d={spans[k]} pathLength={1} className={s.thread} />
        </g>
      ))}
      {HEADS.map((k) => (
        <path key={k} data-head={k} d={heads[k]} className={s.arrow} />
      ))}
      <path data-slash="" d={slash} pathLength={1} className={s.slash} />
    </svg>
  );
}

function Card({ n, slide, before, children }: { n: 1 | 2 | 3 | 4; slide?: boolean; before?: ReactNode; children: ReactNode }) {
  return (
    <li className={clsx(s.slot, [s.slot1, s.slot2, s.slot3, s.slot4][n - 1])} data-card={n}>
      {before}
      <div className={clsx(s.land, slide && s.slide)} style={{ "--c": `var(--c${n}, 1)` } as CSSProperties}>
        {children}
      </div>
    </li>
  );
}

/** The card's place in the loop, so a paused reader knows where to start. The list already numbers it for screen readers. */
const Num = ({ n }: { n: number }) => (
  <span aria-hidden="true" className={s.num}>
    0{n}
  </span>
);

/* ---------- the section ---------- */

export function Problem() {
  const hydrated = useHydrated();
  const pinned = useMedia(PIN_Q);
  const reduced = useMedia(REDUCED_Q);
  const mode: Mode = !hydrated || reduced ? "still" : pinned ? "pin" : "play";

  const root = useRef<HTMLElement>(null);
  const sheet = useRef<HTMLElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const geoNow = useRef<Geo | null>(null);
  const written = useRef(new Map<string, string>());
  const tNow = useRef<number>(REST);
  // Stacked, the ring follows card 1's own place on the screen rather than the shared timeline (null: use the timeline).
  const ringNow = useRef<number | null>(null);
  // Stacked, the payoff likewise prints as it comes up the screen.
  const poNow = useRef<number | null>(null);
  // Pinned, how far the payoff has faded as B's edge comes up under it (0 to 1).
  const pqNow = useRef(0);
  const payoff = useRef<HTMLParagraphElement>(null);
  const blur = `problem-blur-${useId().replace(/[^\w-]/g, "")}`;

  const render = useCallback(
    (t: number) => {
      const el = root.current;
      if (!el) return;
      tNow.current = t;
      const set = (k: string, v: number | string) => {
        const str = typeof v === "number" ? v.toFixed(4) : v;
        if (written.current.get(k) === str) return;
        written.current.set(k, str);
        el.style.setProperty(k, str);
      };

      // Reduced motion writes nothing: every property's default is the finished sheet. Only the string, which has no
      // CSS default for its cut, is drawn below at rest.
      if (mode === "still") t = REST;
      else if (mode === "pin") {
        // The entrance: out of the desk's shade (smoothstep), rising and settling on --ease-out-expo. The hinge turns
        // from 118deg (lifted back, its edge short of the heading) to flat on --ease-in-out-quart.
        set("--y", `${(6 * (1 - outExpo(seg(t, T.rise)))).toFixed(3)}vh`);
        set("--lean", `${(14 * (1 - outExpo(seg(t, T.lean)))).toFixed(3)}deg`);
        set("--tilt", `${(-5.5 + 4.3 * outExpo(seg(t, T.tilt))).toFixed(3)}deg`);
        const th = 118 * (1 - inOutQuart(seg(t, T.fold)));
        const rad = (th * Math.PI) / 180;
        const light = seg(t, T.shade);
        set("--fold", `${th.toFixed(2)}deg`);
        set("--shade", 0.92 * (1 - light * light * (3 - 2 * light)));
        // Lamp upper left: a face darkens as it turns away, the inside by (1 - cos)/2, the outside by (1 + cos)/2.
        set("--sf", ((1 - Math.cos(rad)) / 2) * 0.62);
        set("--sb", ((1 + Math.cos(rad)) / 2) * 0.5);
        set("--hinge", Math.sin(rad) * 0.55);
        set("--fsy", (1 + Math.max(0, Math.cos(rad))) / 2);
        set("--open", seg(t, [T.fold[1] - 8, T.fold[1]]));
        // The docket on the flap's back goes before the flap turns edge-on, where its type would smear.
        set("--dk", clamp((th - 100) / 14));
        const phase = th > 0.05 ? "fold" : "open";
        if (el.dataset.phase !== phase) el.dataset.phase = phase;
        // After the cut the lamp narrows to a pool on it; as B scrolls over, the whole sheet sinks a little further.
        set("--dim", outQuart(seg(t, T.dim)));
        set("--dimx", 0.35 * outQuart(seg(t, T.sink)));
        set("--sc", 1 - 0.025 * outQuart(seg(t, T.sink)));
        set("--src", seg(t, T.sources));
        // The payoff holds until B's edge is 150px below it, then fades in place (from at() below).
        set("--pq", outQuart(pqNow.current));
        // The snap: both pins kick 2px away from the cut, once.
        const sn = seg(t, T.snip);
        set("--jolt", Math.sin(Math.PI * sn) * (1 - sn) * 2.4);
      }

      if (mode !== "still") {
        for (const [n, range] of [
          [1, T.card1],
          [2, T.card2],
          [3, T.card3],
          [4, T.card4],
        ] as const) {
          set(`--c${n}`, outExpo(seg(t, range)));
          // The brass pin goes in as the card settles.
          set(`--p${n}`, clamp((seg(t, range) - 0.55) * 3));
        }
        const fig = seg(t, T.fig);
        set("--f1", clamp(fig * 2));
        set("--ink1", 1 - outQuart(fig));
        set("--hl", outQuart(seg(t, T.hl)));
        const st = seg(t, T.stamp);
        set("--sto", clamp(st * 3));
        set("--sts", stampScale(st));
        set("--ring", outQuart(ringNow.current ?? seg(t, T.ring)));
        set("--mk", outQuart(seg(t, T.mark)));
        set("--mks", stampScale(seg(t, T.mark)));
        // The lead prints as the string snaps; the rest after it. Stacked, both wait for the cut and for the payoff
        // to come up the screen.
        const cut = seg(t, T.snip);
        const lead = seg(t, [T.payoff[0], T.payoff[0] + PAYOFF_LEAD]);
        const rest = seg(t, [T.payoff[1] - PAYOFF_REST, T.payoff[1]]);
        set("--po", outExpo(poNow.current === null ? lead : Math.min(poNow.current, cut)));
        set("--po2", outExpo(poNow.current === null ? rest : Math.min(poNow.current, cut)));
      }

      const g = geoNow.current;
      const svgEl = svg.current;
      if (!g || !svgEl) return;
      const d1 = outQuart(seg(t, T.span1));
      const d2 = outQuart(seg(t, T.span2));
      const d3 = outQuart(seg(t, T.span3));
      const dr = outQuart(seg(t, T.ret));
      // The snap is fast (--ease-out-expo over 5vh); the loose ends then fall slowly.
      const k = outExpo(seg(t, T.snip));
      const fall = outQuart(seg(t, T.droop));
      const a3 = clamp(d3 * 2);
      const b3 = clamp(d3 * 2 - 1);
      // Half A grows from card 3's pin to the cut, then half B from the cut on to card 4's pin (it is drawn
      // pin-to-cut, so it shows [1 - b, 1]). The snap pulls each half back toward its own pin.
      // Each end recoils a fixed distance from the cut (22px on the board, 14px stacked), so the gap reads as a cut
      // in both layouts rather than an unfinished string.
      const { lens } = loopPaths(g);
      const rec = g.stacked ? 14 : 22;
      const ra = clamp(rec / (lens[0] || 1), 0, 0.5) * k;
      const rb = clamp(rec / (lens[1] || 1), 0, 0.5) * k;
      const show: Record<Span, ReturnType<typeof dash>> = {
        span1: dash(0, d1),
        span2: dash(0, d2),
        cutA: dash(0, a3 * (1 - ra)),
        cutB: k > 0 ? dash(0, 1 - rb) : dash(1 - b3, 1),
        ret: g.stacked ? null : dash(0, dr),
      };
      for (const p of svgEl.querySelectorAll<SVGPathElement>("[data-span]")) {
        const v = show[p.dataset.span as Span];
        const vis = v ? "visible" : "hidden";
        if (p.style.visibility !== vis) p.style.visibility = vis;
        if (v && p.style.strokeDasharray !== v.array) p.style.strokeDasharray = v.array;
        if (v && p.style.strokeDashoffset !== v.offset) p.style.strokeDashoffset = v.offset;
      }
      // Each arrowhead inks in as its span arrives; span 3's goes with the cut, since nothing flows through it after.
      const heads: Record<Head, number> = {
        span1: clamp((d1 - 0.85) * 7),
        span2: clamp((d2 - 0.85) * 7),
        span3: clamp((b3 - 0.85) * 7) * (1 - k),
        ret: g.stacked ? 0 : clamp((dr - 0.85) * 7),
      };
      for (const p of svgEl.querySelectorAll<SVGPathElement>("[data-head]")) {
        const o = heads[p.dataset.head as Head].toFixed(3);
        if (p.style.opacity !== o) p.style.opacity = o;
      }
      const sl = svgEl.querySelector<SVGPathElement>("[data-slash]");
      const mk = dash(0, outQuart(seg(t, T.mark)));
      if (sl) {
        sl.style.visibility = mk ? "visible" : "hidden";
        if (mk) sl.style.strokeDasharray = mk.array;
      }
      // On the board each loose end falls about 25px, with a slight sway past rest as it settles. Stacked, the ends
      // stay straight on the chain's line, a clear gap either side of the slash.
      const [p3, p4] = [g.pts[2], g.pts[3]];
      const sway = fall + 0.14 * Math.sin(Math.PI * fall) * (1 - fall);
      const droop = g.stacked ? 0 : 2 * k + 5 * sway;
      const sa = g.stacked ? 1 : p3[0] >= p4[0] ? -1 : 1;
      const turn = (deg: number, p: Pt) => `rotate(${deg.toFixed(2)} ${f1(p[0])} ${f1(p[1])})`;
      svgEl.querySelector("[data-cut=a]")?.setAttribute("transform", turn(sa * droop, p3));
      svgEl.querySelector("[data-cut=b]")?.setAttribute("transform", turn(-sa * droop, p4));
    },
    [mode],
  );

  // Pins: on the board each sits in the card corner nearest the loop's middle (card 1 bottom right, card 2 bottom left,
  // card 3 top left, card 4 top right), so the loop runs through the middle third and no span crosses a card; stacked,
  // they run down the left margin. Measured untransformed (the cards' tilt moves a corner 1-3px at most).
  useLayoutEffect(() => {
    const ol = list.current;
    if (!ol) return;
    const measure = () => {
      const stacked = !window.matchMedia(BOARD_Q).matches;
      const lis = [...ol.querySelectorAll<HTMLElement>("[data-card]")];
      const pts = lis.map((li, i): Pt => {
        if (stacked) return [13, li.offsetTop + 20];
        const { offsetLeft: x, offsetTop: y, offsetWidth: w, offsetHeight: h } = li;
        const k = 8;
        return (
          [
            [x + w - k, y + h - k],
            [x + k, y + h - k],
            [x + k, y + k],
            [x + w - k, y + k],
          ] as Pt[]
        )[i];
      });
      // Stacked, the cut falls in the gap above card 4, where it is stamped; the chain is straight, so y is linear in u.
      let cutU = 0.5;
      if (stacked && lis.length === 4) {
        // Level with the middle of the stamp that names it (problem.module.css .cutTag: 32px tall, 6px above card 4).
        const gapMid = lis[3].offsetTop - 22;
        cutU = clamp((gapMid - pts[2][1]) / (pts[3][1] - pts[2][1] || 1), 0.1, 0.95);
      }
      const next: Geo = { pts, w: ol.offsetWidth, h: ol.offsetHeight, stacked, cutU };
      setGeo((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      // On the board the payoff and the lamp's last pool sit on the cut.
      const root_ = root.current;
      if (root_ && !stacked && pts.length === 4) {
        const { mid } = loopPaths(next);
        root_.style.setProperty("--cut-x", `${((mid[0] / ol.offsetWidth) * 100).toFixed(2)}%`);
        root_.style.setProperty("--cut-y", `${((mid[1] / ol.offsetHeight) * 100).toFixed(2)}%`);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(ol);
    ol.querySelectorAll("[data-card]").forEach((li) => ro.observe(li));
    return () => ro.disconnect();
  }, []);

  // A new layout redraws the string at the current frame.
  useLayoutEffect(() => {
    geoNow.current = geo;
    render(tNow.current);
  }, [geo, render]);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el || mode === "still") return;
    el.dataset.armed = "";
    const written_ = written.current;
    // Not pinned, the sheet only plays forward: what has landed stays landed until the section is below the screen.
    let latch = -Infinity;
    let ringLatch = 0;
    let poLatch = 0;

    const at = (): number => {
      const vh = window.innerHeight;
      if (mode === "pin") {
        const next = el.nextElementSibling;
        const pb = payoff.current?.getBoundingClientRect().bottom;
        pqNow.current = next && pb !== undefined ? clamp((pb + 150 - next.getBoundingClientRect().top) / 130) : 0;
        return ((vh - el.getBoundingClientRect().top) / vh) * 100;
      }
      // Not pinned: map the scroll onto the timeline through knots on the page, read fresh each time (fonts and the
      // sections above can move them).
      const y = window.scrollY;
      const top = (e: Element) => e.getBoundingClientRect().top + y;
      const bottom = (e: Element) => e.getBoundingClientRect().bottom + y;
      const sh = sheet.current;
      const cards = [...(list.current?.querySelectorAll("[data-card]") ?? [])];
      if (!sh || cards.length !== 4) return REST;
      const stacked = !window.matchMedia(BOARD_Q).matches;
      if (!stacked) {
        ringNow.current = null;
        poNow.current = null;
        return piecewise(
          [
            [top(sh) - 0.6 * vh, T.card1[0]],
            [bottom(sh) - 1.02 * vh, T.sources[1]],
            [bottom(sh) - 0.92 * vh, T.droop[1]],
            [bottom(sh) - 0.8 * vh, T.payoff[1]],
          ],
          y,
        );
      }
      // Stacked: card 1 lands as it comes up the screen (so the sheet is never a blank block), cards 2 and 3 as their
      // tops reach 82%, card 4 at 86%, and the cut while the gap above card 4 is in the lower third (before the payoff
      // can reach the screen). The ring and the payoff follow their own places on the screen: the ring while card 1 is
      // mid-screen, the payoff as it comes up past 92%, and never before the cut.
      const c1 = cards[0].getBoundingClientRect().top;
      ringNow.current = clamp((0.72 * vh - c1) / (0.27 * vh));
      const pt = payoff.current?.getBoundingClientRect().top ?? 0;
      poNow.current = clamp((0.92 * vh - pt) / (0.16 * vh));
      return piecewise(
        [
          [top(cards[0]) - 1.0 * vh, T.card1[0]],
          [top(cards[0]) - 0.88 * vh, T.card1[1]],
          [top(cards[1]) - 0.82 * vh, T.card2[0]],
          [bottom(cards[1]) - 0.92 * vh, T.stamp[1]],
          [top(cards[2]) - 0.82 * vh, T.card3[0]],
          [top(cards[3]) - 0.86 * vh, T.card4[0]],
          [top(cards[3]) - 0.78 * vh, T.mark[0]],
          [top(cards[3]) - 0.64 * vh, T.droop[1]],
        ],
        y,
      );
    };

    const tick = () => {
      let t = at();
      if (mode === "play") {
        if (el.getBoundingClientRect().top > window.innerHeight) {
          latch = t;
          ringLatch = ringNow.current ?? 0;
          poLatch = poNow.current ?? 0;
        } else {
          latch = Math.max(latch, t);
          if (ringNow.current !== null) ringLatch = Math.max(ringLatch, ringNow.current);
          if (poNow.current !== null) poLatch = Math.max(poLatch, poNow.current);
        }
        t = latch;
        if (ringNow.current !== null) ringNow.current = ringLatch;
        if (poNow.current !== null) poNow.current = poLatch;
      }
      render(t);
    };
    tick();
    window.addEventListener("scroll", tick, { passive: true });
    window.addEventListener("resize", tick);
    return () => {
      window.removeEventListener("scroll", tick);
      window.removeEventListener("resize", tick);
      // Leaving a mode (a resize, a reduced-motion switch) drops everything it wrote, so the next starts clean.
      for (const k of written_.keys()) el.style.removeProperty(k);
      written_.clear();
      delete el.dataset.phase;
      delete el.dataset.armed;
      el.querySelectorAll("[data-span], [data-head], [data-slash]").forEach((p) => p.removeAttribute("style"));
      el.querySelectorAll("[data-cut]").forEach((g) => g.removeAttribute("transform"));
      tNow.current = REST;
      ringNow.current = null;
      poNow.current = null;
      pqNow.current = 0;
    };
  }, [mode, render]);

  return (
    <section id="problem" ref={root} aria-labelledby="problem-title" className={clsx(s.section, "scroll-mt-16")}>
      {mode === "pin" && <SkipLink href="#checks">Skip to the five checks</SkipLink>}
      <div className={clsx(s.stage, "page")}>
        <div aria-hidden="true" className={s.pool} />
        {/* On the page gutter, like every other exhibit's label. */}
        <p className={clsx("micro", s.eyebrow)}>
          Exhibit <span className="text-text-2">A</span> · The problem
        </p>
        <div className={s.column}>
          <div className={s.board}>
            <div className={s.persp}>
              <div className={s.lift}>
                <div aria-hidden="true" className={s.floor} />
                <article ref={sheet} className={s.sheet}>
                  <div aria-hidden="true" className={s.paper} />
                  <div aria-hidden="true" className={s.hinge} />
                  <div aria-hidden="true" className={s.flap}>
                    <div className={s.flapFront}>
                      <div className={s.paper} />
                      <div className={s.turn} />
                      <div className={s.faceShade} />
                    </div>
                    <div className={s.flapBack}>
                      <p className={s.docket}>
                        <span>Exhibit A</span>
                        <span>36 refund recalls · 1 Oct–5 Nov 2026</span>
                      </p>
                      <div className={s.turn} />
                      <div className={s.faceShade} />
                    </div>
                  </div>

                  <header className={s.head}>
                    <h2 id="problem-title" className={s.title}>
                      Recall refunds are <span className="block">stuck in a loop.</span>
                    </h2>
                    <p className={s.sub}>Easy refunds get faked. Hard ones get skipped.</p>
                  </header>

                  <ol ref={list} className={s.cards} aria-label="The loop">
                    {geo && <Loop geo={geo} ref={svg} blur={blur} />}

                    <Card n={1}>
                      <div className={s.card}>
                        <p className={s.cardLabel}>
                          <Num n={1} />
                          Recalled products stay in homes.
                        </p>
                        {/* "Only" keeps the figure saying what the label says: few come back, the rest stay. PIRG's words. */}
                        <p className={s.stat}>
                          <span className={s.print}>Only</span>{" "}
                          <span className={s.figure}>
                            <span className={s.print}>6–10%</span>
                            <svg className={s.ring} viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
                              <path pathLength={1} d={RING} />
                            </svg>
                          </span>
                        </p>
                        <p className={clsx(s.cardLine, s.statCaption)}>of recalled products are returned or discarded.</p>
                      </div>
                    </Card>

                    <Card n={2}>
                      <div className={clsx(s.card, s.notice)}>
                        <p className={s.cardLabel}>
                          <Num n={2} />
                          Easy refunds run on emailed photos.
                        </p>
                        <figure className={s.doc}>
                          <figcaption className={s.docMeta}>
                            <span className={s.docNo}>CPSC 27-071 · </span>
                            <span>Nursing pillow</span> <span>· Suffocation risk</span>
                          </figcaption>
                          <blockquote className={s.excerpt}>
                            &ldquo;&hellip;cut the pillow in half&hellip; send a photo&hellip; to{" "}
                            <span className={s.nowrap}>
                              <span className={clsx(s.address, s.highlight)}>z•••••929@gmail.com</span>
                              .&rdquo;
                            </span>
                            <span className={s.stamp}>
                              <Stamp tone="stop" rotate={-7} className={s.stampInk}>
                                Received
                              </Stamp>
                            </span>
                          </blockquote>
                        </figure>
                        <p className={clsx(s.cardLine, s.count)}>
                          <span className={s.countFig}>20 of 27</span> recent photo recalls collect the photo by email.
                        </p>
                      </div>
                    </Card>

                    <Card n={3} slide>
                      <div className={s.strip}>
                        <div className={s.stripPaper}>
                          <p className={s.cardLabel}>
                            <Num n={3} />
                            The photo can be faked.
                          </p>
                          <p className={s.stripHead}>The US safety regulator&rsquo;s own filing warns of</p>
                          <p className={clsx(s.stripText, facsimile.className)}>&ldquo;artificially generated images.&rdquo;</p>
                        </div>
                      </div>
                    </Card>

                    <Card
                      n={4}
                      before={
                        // Named only once the string is there to be cut (it is measured in the browser).
                        geo && (
                          <span aria-hidden="true" className={s.cutTag}>
                            <Stamp tone="pay" rotate={-5} className={s.cutStamp}>
                              Cut by Remedy
                            </Stamp>
                          </span>
                        )
                      }
                    >
                      <div className={s.card}>
                        <p className={s.cardLabel}>
                          <Num n={4} />
                          Fraud checks push owners away.
                        </p>
                        <p className={s.cardLine}>
                          The same filing says they <span className={s.quote}>&ldquo;reduce recall participation.&rdquo;</span>
                        </p>
                        <p aria-hidden="true" className={s.back}>
                          &#8634; Back to 01
                        </p>
                      </div>
                    </Card>

                    {geo?.pts.map((p, i) => (
                      <span
                        key={i}
                        aria-hidden="true"
                        className={clsx(s.pin, i === 2 && s.pinA, i === 3 && s.pinB)}
                        style={{
                          left: p[0],
                          top: p[1],
                          opacity: `var(--p${i + 1}, 1)`,
                        }}
                      />
                    ))}
                  </ol>

                  <p ref={payoff} className={s.payoff}>
                    <span className={s.payoffLead}>Remedy cuts the loop.</span>{" "}
                    <span className={s.payoffRest}>The refund stays easy for a real owner and expensive for a fake.</span>
                  </p>

                  <p className={s.sources}>
                    <span className={s.sourcesLabel}>Sources:</span>{" "}
                    {SOURCES.map((src, i) => (
                      <span key={src.href} className={s.source}>
                        <span className={s.nowrap}>
                          <a href={src.href} target="_blank" rel="noopener noreferrer">
                            {src.label}
                            <span className="sr-only"> (opens in a new tab)</span>
                          </a>
                          {i < SOURCES.length - 1 && <span className={s.sep}>&nbsp;·</span>}
                        </span>{" "}
                      </span>
                    ))}
                  </p>

                  <div aria-hidden="true" className={s.shadeTop} />
                  <div aria-hidden="true" className={s.spot} />
                  <div aria-hidden="true" className={s.dim} />
                </article>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
