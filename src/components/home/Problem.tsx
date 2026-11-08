"use client";

import clsx from "clsx";
import { Tinos } from "next/font/google";
import { useCallback, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode, type Ref } from "react";
import { SkipLink, Stamp } from "@/components/ui";
import s from "./problem.module.css";
import { clamp, dash, inOutQuart, outExpo, outQuart, piecewise, REST, seg, stampScale, T } from "./problemTimeline";

/*
 * Exhibit A: one aged evidence sheet on the dark desk. On a laptop (at least 1024 x 700, motion allowed) it rises out
 * of the dark folded in half, the lower half swings down like a map opening, four cards land on brass pins, one red
 * string closes the loop between them, the string is cut where Remedy steps in, the lamp goes down on the sheet and
 * the payoff prints over the cut. Section B then slides over it like a page laid on top. Every beat is scrubbed by the
 * scroll (problemTimeline.ts), so fast and slow readers, and readers scrolling back, all see the same frame.
 *
 * Architecture after the "unfold" prototype: one function maps scroll to t and writes CSS custom properties; each
 * property defaults to the finished sheet, so no JS and reduced motion get it open, pinned, cut and paid off. The
 * fold is hand-built CSS 3D (a hinge at half height, its face a window onto a second copy of the paper), after Thomas
 * Park's folding map and oriDomi's clone-and-shade idea (dmotz, MIT; technique only, no code). A library would add
 * weight for one hinge.
 *
 * Phones and short laptops get the open sheet with the cards stacked; each card lands as it reaches the reader, and
 * the cut and payoff follow the sheet's foot.
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
type Geo = { pts: Pt[]; w: number; h: number; stacked: boolean };
const SPANS = ["span1", "span2", "cutA", "cutB", "ret"] as const;
type Span = (typeof SPANS)[number];

/** One slack span: a quadratic whose control point is the midpoint pushed `sag` of the span's length along `dir`. */
function quad(a: Pt, b: Pt, dir: Pt, sag: number): [Pt, Pt, Pt] {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return [a, [(a[0] + b[0]) / 2 + dir[0] * len * sag, (a[1] + b[1]) / 2 + dir[1] * len * sag], b];
}
const f1 = (n: number) => n.toFixed(1);
const qd = ([a, c, b]: [Pt, Pt, Pt]) => `M${f1(a[0])},${f1(a[1])} Q${f1(c[0])},${f1(c[1])} ${f1(b[0])},${f1(b[1])}`;

/** The loop's spans in eye-path order. Span 3 (the faked photo to the fraud checks) comes as two halves so it can be cut. */
function loopPaths({ pts, stacked }: Geo): Record<Span, string> {
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
  const [a, c, b] = quad(p3, p4, dirFor(p3, p4), sag);
  // Split at the middle (de Casteljau): half A runs from card 3's pin to the cut, half B from card 4's pin to it.
  const ac: Pt = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
  const cb: Pt = [(c[0] + b[0]) / 2, (c[1] + b[1]) / 2];
  const mid: Pt = [(ac[0] + cb[0]) / 2, (ac[1] + cb[1]) / 2];
  // Stacked, the return climbs the sheet's left margin, outside the chain.
  const m = p1[0] - 30;
  const ret = stacked
    ? `M${f1(p4[0])},${f1(p4[1])} C${f1(m)},${f1(p4[1] - 24)} ${f1(m)},${f1(p1[1] + 24)} ${f1(p1[0])},${f1(p1[1])}`
    : qd(quad(p4, p1, dirFor(p4, p1), 0.07));
  return {
    span1: qd(quad(p1, p2, dirFor(p1, p2), sag)),
    span2: qd(quad(p2, p3, dirFor(p2, p3), sag)),
    cutA: qd([a, ac, mid]),
    cutB: qd([b, cb, mid]),
    ret,
  };
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
  const d = loopPaths(geo);
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
          <path data-span={k} d={d[k]} pathLength={1} className={s.threadShadow} filter={`url(#${blur})`} />
          <path data-span={k} d={d[k]} pathLength={1} className={s.thread} />
        </g>
      ))}
    </svg>
  );
}

function Card({ n, slide, children }: { n: 1 | 2 | 3 | 4; slide?: boolean; children: ReactNode }) {
  return (
    <li className={clsx(s.slot, [s.slot1, s.slot2, s.slot3, s.slot4][n - 1])} data-card={n}>
      <div className={clsx(s.land, slide && s.slide)} style={{ "--c": `var(--c${n}, 1)` } as CSSProperties}>
        {children}
      </div>
    </li>
  );
}

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
  const payoff = useRef<HTMLParagraphElement>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const geoNow = useRef<Geo | null>(null);
  const written = useRef(new Map<string, string>());
  const tNow = useRef<number>(REST);
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
        // The entrance: out of the dark (smoothstep), rising and settling on --ease-out-expo. The hinge turns from
        // 132deg (lifted back over the heading) to flat on --ease-in-out-quart, so the swing lands while it's in view.
        set("--y", `${(30 * (1 - outExpo(seg(t, T.rise)))).toFixed(3)}vh`);
        set("--lean", `${(14 * (1 - outExpo(seg(t, T.lean)))).toFixed(3)}deg`);
        set("--tilt", `${(-5.5 + 4.3 * outExpo(seg(t, T.tilt))).toFixed(3)}deg`);
        const th = 132 * (1 - inOutQuart(seg(t, T.fold)));
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
        const phase = th > 0.05 ? "fold" : "open";
        if (el.dataset.phase !== phase) el.dataset.phase = phase;
        // The exit: after the cut the lamp goes down on the sheet; as B slides over it, it dims further and eases back.
        set("--dim", 0.74 * outQuart(seg(t, T.dim)) + 0.12 * seg(t, T.cover));
        set("--sc", 1 - 0.025 * outQuart(seg(t, T.cover)));
        set("--src", seg(t, T.sources));
      }

      if (mode !== "still")
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
      if (mode !== "still") {
        const fig = seg(t, T.fig);
        set("--f1", clamp(fig * 2));
        set("--ink1", 1 - outQuart(fig));
        set("--hl", outQuart(seg(t, T.hl)));
        const st = seg(t, T.stamp);
        set("--sto", clamp(st * 3));
        set("--sts", stampScale(st));
        set("--l2", outExpo(seg(t, T.line2)));
        set("--ring", outQuart(seg(t, T.ring)));
        set("--po", outExpo(seg(t, T.payoff)));
      }

      const g = geoNow.current;
      const svgEl = svg.current;
      if (!g || !svgEl) return;
      const d1 = outQuart(seg(t, T.span1));
      const d2 = outQuart(seg(t, T.span2));
      const d3 = outQuart(seg(t, T.span3));
      const dr = outQuart(seg(t, T.ret));
      const k = outExpo(seg(t, T.snip));
      const a3 = clamp(d3 * 2);
      const b3 = clamp(d3 * 2 - 1);
      // Half A grows from card 3's pin to the middle, then half B from the middle on to card 4's pin (it is drawn
      // pin-to-middle, so it shows [1 - b, 1]). The cut pulls each half back toward its own pin.
      const show: Record<Span, ReturnType<typeof dash>> = {
        span1: dash(0, d1),
        span2: dash(0, d2),
        cutA: dash(0, a3 * (1 - 0.32 * k)),
        cutB: k > 0 ? dash(0, 1 - 0.32 * k) : dash(1 - b3, 1),
        ret: dash(0, dr),
      };
      for (const p of svgEl.querySelectorAll<SVGPathElement>("[data-span]")) {
        const v = show[p.dataset.span as Span];
        const vis = v ? "visible" : "hidden";
        if (p.style.visibility !== vis) p.style.visibility = vis;
        if (v && p.style.strokeDasharray !== v.array) p.style.strokeDasharray = v.array;
        if (v && p.style.strokeDashoffset !== v.offset) p.style.strokeDashoffset = v.offset;
      }
      // Each loose end falls away from the text: down on the board, into the left margin when stacked.
      const [p3, p4] = [g.pts[2], g.pts[3]];
      const droop = (g.stacked ? 5 : 8) * k;
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
      const next: Geo = { pts, w: ol.offsetWidth, h: ol.offsetHeight, stacked };
      setGeo((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      // The payoff centres on the loop's middle, a little above it so the cut below stays in view.
      const root_ = root.current;
      if (root_ && !stacked) {
        const cx = pts.reduce((a, p) => a + p[0], 0) / 4;
        const cy = pts.reduce((a, p) => a + p[1], 0) / 4;
        root_.style.setProperty("--loop-x", `${((cx / ol.offsetWidth) * 100).toFixed(2)}%`);
        root_.style.setProperty("--loop-y", `${((cy / ol.offsetHeight) * 100 - 1.5).toFixed(2)}%`);
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

    const at = (): number => {
      const vh = window.innerHeight;
      if (mode === "pin") return ((vh - el.getBoundingClientRect().top) / vh) * 100;
      // Not pinned: map the scroll onto the timeline through knots on the page, read fresh each time (fonts and the
      // sections above can move them). Stacked, each card lands as its top reaches 82% of the screen.
      const y = window.scrollY;
      const top = (e: Element) => e.getBoundingClientRect().top + y;
      const bottom = (e: Element) => e.getBoundingClientRect().bottom + y;
      const sh = sheet.current;
      const cards = [...(list.current?.querySelectorAll("[data-card]") ?? [])];
      const pay = payoff.current;
      if (!sh || cards.length !== 4 || !pay) return REST;
      const stacked = !window.matchMedia(BOARD_Q).matches;
      const knots: [number, number][] = stacked
        ? [
            [top(cards[0]) - 0.82 * vh, T.card1[0]],
            [top(cards[1]) - 0.82 * vh, T.card2[0]],
            [bottom(cards[1]) - 0.92 * vh, T.span2[0]],
            [top(cards[2]) - 0.82 * vh, T.card3[0]],
            [top(cards[3]) - 0.82 * vh, T.card4[0]],
            [bottom(cards[3]) - 0.9 * vh, T.ring[1]],
            [bottom(sh) - 0.92 * vh, T.snip[1]],
            [top(pay) - 0.9 * vh, T.payoff[1]],
          ]
        : [
            [top(sh) - 0.6 * vh, T.card1[0]],
            [bottom(sh) - 1.02 * vh, T.ring[1]],
            [bottom(sh) - 0.9 * vh, T.snip[1]],
            [top(pay) - 0.9 * vh, T.payoff[1]],
          ];
      return piecewise(knots, y);
    };

    const tick = () => render(at());
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
      el.querySelectorAll("[data-span]").forEach((p) => p.removeAttribute("style"));
      el.querySelectorAll("[data-cut]").forEach((g) => g.removeAttribute("transform"));
      tNow.current = REST;
    };
  }, [mode, render]);

  return (
    <section id="problem" ref={root} aria-labelledby="problem-title" className={clsx(s.section, "scroll-mt-16")}>
      {mode === "pin" && <SkipLink href="#checks">Skip to the five checks</SkipLink>}
      <div className={clsx(s.stage, "page")}>
        <div aria-hidden="true" className={s.pool} />
        <div className={s.column}>
          <p className="micro text-faint">
            Exhibit <span className="text-text-2">A</span> · The problem
          </p>

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
                        <span>CPSC 27-071 · CPSC-2026-0067</span>
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
                        <p className={s.cardLabel}>Recalled products stay in homes.</p>
                        <p className={clsx(s.cardLine, s.figLine)}>
                          Only{" "}
                          <span className={s.figure}>
                            <span className={s.print}>6–10%</span>
                            <svg className={s.ring} viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
                              <path pathLength={1} d={RING} />
                            </svg>
                          </span>{" "}
                          are returned or discarded.
                        </p>
                      </div>
                    </Card>

                    <Card n={2}>
                      <div className={clsx(s.card, s.notice)}>
                        <p className={s.cardLabel}>The easy fix runs on email.</p>
                        <figure className={s.doc}>
                          <figcaption className={s.docMeta}>
                            <span>CPSC 27-071</span> <span>· Nursing pillow</span> <span>· Suffocation risk</span>
                          </figcaption>
                          <blockquote className={s.excerpt}>
                            &ldquo;&hellip;
                            <span className={s.clause}>cut the pillow in half&hellip; </span>
                            send a photo&hellip; to{" "}
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
                        <p className={clsx(s.cardLine, s.after)}>
                          <span className={s.mono}>20 of 27</span> recalls that asked for a photo from <span className={s.mono}>1 Oct–5 Nov 2026</span> had
                          owners email it to an inbox.
                        </p>
                      </div>
                    </Card>

                    <Card n={3} slide>
                      <div className={s.strip}>
                        <div className={s.stripPaper}>
                          <p className={s.cardLabel}>The photo can be faked.</p>
                          <p className={s.stripHead}>CPSC-2026-0067</p>
                          <p className={clsx(s.stripText, facsimile.className)}>&ldquo;artificially generated images&rdquo;</p>
                        </div>
                      </div>
                    </Card>

                    <Card n={4}>
                      <div className={s.card}>
                        <p className={s.cardLabel}>Fraud checks push owners away.</p>
                        <p className={s.cardLine}>
                          The same filing says they <span className={s.quote}>&ldquo;reduce recall participation.&rdquo;</span>
                        </p>
                      </div>
                    </Card>

                    {geo?.pts.map((p, i) => (
                      <span
                        key={i}
                        aria-hidden="true"
                        className={s.pin}
                        style={{
                          left: p[0],
                          top: p[1],
                          opacity: `var(--p${i + 1}, 1)`,
                        }}
                      />
                    ))}
                  </ol>

                  <p className={s.sources}>
                    Sources:{" "}
                    {SOURCES.map((src, i) => (
                      <span key={src.href}>
                        {i > 0 && " ·\u00a0"}
                        <a href={src.href} target="_blank" rel="noopener noreferrer" className={s.nowrap}>
                          {src.label}
                          <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      </span>
                    ))}
                  </p>

                  <div aria-hidden="true" className={s.shadeTop} />
                  <div aria-hidden="true" className={s.dim} />
                </article>
              </div>
            </div>

            <p ref={payoff} className={s.payoff}>
              <span className={s.payoffLead}>Remedy cuts the loop.</span>{" "}
              <span className={s.payoffRest}>The refund stays easy for a real owner and expensive for a fake.</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
