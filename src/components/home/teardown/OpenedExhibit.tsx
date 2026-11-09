"use client";

import clsx from "clsx";
import { useScroll, type MotionValue } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode, type RefObject } from "react";
import { CheckIcon, Money, Paper, Stamp } from "@/components/ui";
import { CHECKS, CONFIRMED_ROW, EXHIBIT, RECEIPT_ROWS } from "./claim";
import { BEATS, RANGES, RECEIPT_FADE, TOTAL_VH, clock, holdOf, stateAt, tickAt, type BeatId, type ExhibitState, type Shot } from "./model";
import type { Colors, Exhibit, Rect, Tier } from "./scene";
import { createFrameWatch, stageLayers } from "./watch";
import styles from "./teardown.module.css";

// The Opened Exhibit (wave 3, concept 1): claim RM-0442's evidence in 3D, each of the five checks opening the part it
// is about, then the fixed rule and the payout. One input, claim progress p in [0, 1], drives the scene, the
// readouts, the check row, the callouts and the receipt (model.ts). See README.md for where it mounts.
//
// Forms, chosen after mount (the server renders the static one):
// - live: laptops with motion and WebGL. Pinned; three.js is imported when the section is within a viewport.
// - poster: phones (under 768px), no WebGL, or a GPU too slow for tier 1. Pinned; pre-rendered stills crossfade.
// - static: reduced motion, no JS. Not pinned; the final still, every check with its quote, and the receipt.

type Mode = "static" | "poster" | "live";

const subscribeMedia = (q: string) => (cb: () => void) => {
  const m = window.matchMedia(q);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
function useMedia(q: string, server: boolean) {
  return useSyncExternalStore(
    subscribeMedia(q),
    () => window.matchMedia(q).matches,
    () => server,
  );
}

/** Software rasterisers: a floor below any integrated GPU. They get the posters without trying the scene. */
const SOFTWARE_GL = /swiftshader|llvmpipe|softpipe|basic render|software/i;

let webgl: boolean | undefined;
/** WebGL2 on real graphics hardware. */
function hasWebGL() {
  if (webgl === undefined) {
    try {
      const c = document.createElement("canvas");
      const g = c.getContext("webgl2");
      const info = g?.getExtension("WEBGL_debug_renderer_info");
      const renderer = g ? String(g.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : g.RENDERER)) : "";
      webgl = !!g && !SOFTWARE_GL.test(renderer);
      g?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      webgl = false;
    }
  }
  return webgl;
}
const noop = () => () => {};

/** The beats that get a pre-rendered still, in order (posters/<theme>-<beat>-<d|m>.webp). */
const POSTER_BEATS: BeatId[] = ["intro", "live", "fp", "acct", "code", "torn", "paid"];
const posterSrc = (beat: BeatId, dark: boolean, small: boolean) => `/teardown/${dark ? "dark" : "light"}-${beat}-${small ? "m" : "d"}.webp`;

/** ms a still dissolves into the next over, in time once p crosses the beat's start. */
const DISSOLVE = 240;

/** Resolves any CSS colour (oklch, color-mix, var-free) to #rrggbb through a 1px canvas. */
function resolveColor(css: string, fallback: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const g = c.getContext("2d", { willReadFrequently: true });
  if (!g || !css) return fallback;
  g.fillStyle = fallback;
  g.fillStyle = css;
  g.fillRect(0, 0, 1, 1);
  const [r, gg, b] = g.getImageData(0, 0, 1, 1).data;
  return `#${[r, gg, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function readColors(el: HTMLElement): Colors {
  const cs = getComputedStyle(el);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  const bg = resolveColor(v("--bg"), "#0d0c0a");
  const n = parseInt(bg.slice(1), 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return {
    dark: lum < 0.5,
    accent: resolveColor(v("--accent"), "#ebb75b"),
    paper: resolveColor(v("--paper"), "#efebe1"),
    ink: resolveColor(v("--ink"), "#201c18"),
    faint: resolveColor(v("--faint"), "#9a9895"),
  };
}

/** One check in the row along the foot: its name, who reads it, and a tick once passed. The row's order is the count. */
function CheckCell({ i, done, active, onSeek }: { i: number; done: boolean; active: boolean; onSeek?: (i: number) => void }) {
  const c = CHECKS[i];
  const body = (
    <>
      <span className="flex h-full min-w-0 flex-col">
        <span className={clsx("block text-balance text-ui font-medium", done || active ? "text-text" : "text-muted")}>{c.label}</span>
        <span className="mt-auto block text-micro text-faint">{c.ai ? "Photo check" : "No AI"}</span>
      </span>
      <span className={clsx("text-pay transition-opacity duration-160", done ? "opacity-100" : "opacity-0")}>
        <CheckIcon />
        <span className="sr-only">{done ? "passed" : ""}</span>
      </span>
    </>
  );
  return (
    <li className={styles.cell} data-done={done || undefined} data-active={active || undefined}>
      <span className={styles.bar} aria-hidden="true">
        <span data-fill={i} />
      </span>
      {onSeek ? (
        <button type="button" className={styles.cellBody} onClick={() => onSeek(i)} aria-label={`Show check ${i + 1} of 5: ${c.label}`}>
          {body}
        </button>
      ) : (
        <div className={styles.cellBody}>{body}</div>
      )}
    </li>
  );
}

function Receipt({ stamped, className, style }: { stamped: boolean; className?: string; style?: CSSProperties }) {
  return (
    <div className={clsx(styles.receipt, className)} style={style}>
      <Paper variant="receipt" perforated padding="md" className="w-full">
        <p className="flex items-baseline justify-between gap-4 text-ui text-ink-muted">
          Refund
          <span className="font-mono text-micro font-medium text-ink">{EXHIBIT.id}</span>
        </p>
        <p className="mt-3 text-ink">
          <Money value={EXHIBIT.amount} size="amount" />
        </p>
        <dl className="mt-5 border-t border-dashed border-paper-line">
          {RECEIPT_ROWS.map(([k, v, data], i) => (
            // PayPal's confirmation prints with the stamp; until then its line is blank paper (the receipt's height held).
            <div
              key={k}
              className={clsx("flex items-baseline justify-between gap-4 border-b border-dashed border-paper-line py-1.5 text-ui", i === CONFIRMED_ROW && styles.printed)}
              data-on={i !== CONFIRMED_ROW || stamped || undefined}
            >
              <dt className="text-ink-muted">{k}</dt>
              <dd className={clsx("text-ink", data && "font-mono")}>{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          <span className={styles.stampSlot}>
            {stamped && (
              <Stamp tone="pay" land>
                PAID
              </Stamp>
            )}
          </span>
        </div>
      </Paper>
    </div>
  );
}

/** Everything a screen reader needs, in one static list: the canvas and the moving readouts are hidden from it. */
function ScreenReaderSummary() {
  return (
    <div className="sr-only">
      <ol>
        {CHECKS.map((c) => (
          <li key={c.id}>
            {c.label}, {c.ai ? "read by the model" : "no AI"}: passed. {c.note} {c.quote ? `The model’s words: “${c.quote}”` : ""}
          </li>
        ))}
      </ol>
      <p>
        A fixed rule approved it, and ${EXHIBIT.amount} was sent to the owner&rsquo;s PayPal account {EXHIBIT.seconds} seconds after the photo; PayPal confirmed it at {EXHIBIT.confirmed} seconds.
      </p>
    </div>
  );
}

function Header({ compact, chapter }: { compact?: boolean; chapter?: string }) {
  return (
    <div className="min-w-0">
      <p className="eyebrow text-muted whitespace-nowrap">{chapter ?? "How it works"}</p>
      {/* One ink, as every heading on the page: the second tone is for labels only. */}
      <h2 className={clsx("mt-3 max-w-[26ch] text-pretty font-medium", compact ? "text-head-sm" : "text-title")}>Five checks pass, then PayPal pays the owner.</h2>
    </div>
  );
}

function Readouts({ s }: { s: Pick<ExhibitState, "seconds" | "decision" | "done" | "active" | "sent" | "stamped"> }) {
  const items: [string, React.ReactNode][] = [
    [
      "Since the photo",
      <span key="c" className="font-mono">
        {clock(s.seconds)}
      </span>,
    ],
    [
      "Decision",
      s.decision === "pay" ? (
        "Approved"
      ) : s.decision === "checking" ? (
        // The check being run, as the hero's laptop counts it.
        `Checking ${s.active >= 0 ? s.active + 1 : Math.min(5, s.done + 1)} of 5`
      ) : (
        "No photo yet"
      ),
    ],
    [
      "Payout",
      // The amount is the receipt's, which lands with it: here only the state, in the console's words. Paid (the one
      // green) only once PayPal confirms it, with the receipt's stamp; Sent before that.
      s.stamped ? (
        <span key="p" className="text-pay">
          Paid
        </span>
      ) : s.sent ? (
        "Sent"
      ) : (
        "Waiting"
      ),
    ],
  ];
  return (
    <dl className={styles.readouts} aria-hidden="true">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-ui text-muted">{k}</dt>
          <dd className="mt-1.5 text-body font-medium whitespace-nowrap">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Check 3's object: the owner's PayPal account as Remedy reads it when PayPal logs them in (verified, and this its one
 * claim on the recall). Flat UI on a hairline, eased in and out with the check's callout (the frame toggles data-on).
 */
function AccountCard({ ref }: { ref: RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={ref} className={styles.account}>
      <p className="text-ui text-muted">PayPal account</p>
      <p className="flex items-center gap-2 text-body font-medium">
        <CheckIcon size={16} className="text-pay" />
        Verified
      </p>
      <p className="text-ui text-text-2">
        1 claim on <span className="font-mono">{EXHIBIT.recall}</span>
      </p>
    </div>
  );
}

/** What the owner's photo must show, as the claim page's camera lists it (the code chapter's shot list). */
const FRAME_LIST = [`The ${EXHIBIT.label} tag`, "The pillow cut fully in half", `The code ${EXHIBIT.code}, on the tag`];

/** The intro's callout: the owner cutting the pillow and framing it, each thing coming into the frame in turn. */
function IntroCallout({ framed }: { framed: number }) {
  return (
    <div className={styles.callout}>
      <p className="text-ui text-muted">In the claim page&rsquo;s camera</p>
      <p className="mt-2 text-body font-medium text-text">The owner cuts the pillow and frames it, tag and all.</p>
      <p className="mt-1 text-ui text-muted">Nothing is checked or paid until the photo is taken.</p>
      {/* On a hairline, each thing's node lighting as it comes into the frame (no numerals: the order is the line). */}
      <ol className="relative mt-4 flex flex-col gap-2.5 before:absolute before:top-2 before:bottom-2 before:left-[3.5px] before:w-px before:bg-line">
        {FRAME_LIST.map((f, i) => (
          <li key={f} className={clsx("relative grid grid-cols-[1.25rem_minmax(0,1fr)] text-ui transition-opacity duration-160", i < framed ? "opacity-100" : "opacity-35")}>
            <span className="mt-1.5 flex size-2 rounded-full bg-bg">
              <span className="block size-2 rounded-full border border-text-2" />
            </span>
            {f}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Callout({ s }: { s: ExhibitState }) {
  if (s.beat === "intro") return <IntroCallout framed={s.framed} />;
  // Check 5's words hold into the payout until the receipt lands over them.
  const i = s.beat === "paid" ? CHECKS.length - 1 : s.active;
  if (i < 0) return null;
  const c = CHECKS[i];
  return (
    <div className={styles.callout}>
      <p className="text-ui text-muted">Check {i + 1} of 5</p>
      <p className="mt-2 text-body font-medium text-text">{c.label}</p>
      <p className="mt-1 text-ui text-muted">{c.note}</p>
      {c.quote && (
        <figure className="mt-4">
          <blockquote className="text-ui leading-[1.55] text-text-2">“{c.quote}”</blockquote>
          <figcaption className="mt-2 text-micro text-faint">The model’s words on this photo, verbatim</figcaption>
        </figure>
      )}
    </div>
  );
}

// ---- The pinned stage (live and poster forms).

interface StageProps {
  p: MotionValue<number>;
  mode: "live" | "poster";
  small: boolean;
  onSeek?: (i: number) => void;
  /** A skip link for the foot of the stage, so the pin is never without one. */
  skip?: ReactNode;
  /** Dev and capture only: draw at this p and keep the drawing buffer for screenshots. */
  capture?: boolean;
}

function discreteKey(s: ExhibitState) {
  return [s.beat, s.active, s.framed, s.done, s.chars, s.charNow, clock(s.seconds), s.decision, s.sent, s.stamped, s.receipt > 0].join("|");
}

function Stage({ p, mode, small, onSeek, skip, capture }: StageProps) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const subject = useRef<HTMLDivElement>(null);
  const calloutBox = useRef<HTMLDivElement>(null);
  const account = useRef<HTMLDivElement>(null);
  const leader = useRef<SVGPathElement>(null);
  const dot = useRef<SVGCircleElement>(null);
  const receipt = useRef<HTMLDivElement>(null);
  const posters = useRef<HTMLDivElement>(null);
  /** The still the posters show, and on which posters element (a fallback mounts a new one). */
  const shown = useRef<{ el: HTMLDivElement | null; at: number }>({ el: null, at: -1 });
  const [s, setS] = useState<ExhibitState>(() => stateAt(p.get()));
  const [dark, setDark] = useState(true);
  const [warm, setWarm] = useState(false);
  const [failed, setFailed] = useState(false);
  const scene = useRef<Exhibit | null>(null);
  const rectOverride = useRef<Rect | null>(null);
  const shotOverride = useRef<Shot | null>(null);
  const live = mode === "live" && !failed;

  // Tier drop on long frames, measured where it matters: while scrolling, a drawn frame whose next frame comes more
  // than 28 ms later (median of 8, so a weak GPU falls back within one beat) steps down to tier 1, then to the posters.
  // The start-up benchmark can't see compositing costs. Each draw is timed to the next frame, not to the next draw:
  // draws only happen when p changes, and a wheel easing to a stop moves p a pixel at a time, 30 to 80 ms apart.
  const watch = useRef(createFrameWatch());
  const probe = useRef(0);
  const watchFrames = useCallback(
    (ex: Exhibit) => {
      if (capture || probe.current) return;
      const drawn = performance.now();
      probe.current = requestAnimationFrame(() => {
        probe.current = 0;
        if (scene.current !== ex || !watch.current(performance.now() - drawn)) return;
        if (ex.info().tier === 2) {
          ex.setTier(1);
          const r = root.current?.getBoundingClientRect();
          if (r) ex.resize(r.width, r.height, devicePixelRatio);
          if (root.current) root.current.dataset.tier = "1";
        } else setFailed(true);
      });
    },
    [capture],
  );

  // Draw one frame for the current p: the scene, then the continuous DOM (leader, callout, receipt, poster fades).
  const draw = useCallback(() => {
    const el = root.current;
    if (!el) return;
    const st = stateAt(p.get());
    if (shotOverride.current) st.shot = shotOverride.current;
    const key = discreteKey(st);
    setS((prev) => (discreteKey(prev) === key ? prev : st));
    const stage = el.getBoundingClientRect();
    let anchor: { x: number; y: number } | null = null;
    const ex = scene.current;
    if (ex && live) {
      const r = subject.current?.getBoundingClientRect();
      const rect: Rect =
        rectOverride.current ??
        (r
          ? {
              x0: (r.left - stage.left) / stage.width,
              y0: (r.top - stage.top) / stage.height,
              x1: (r.right - stage.left) / stage.width,
              y1: (r.bottom - stage.top) / stage.height,
            }
          : { x0: 0.05, y0: 0.2, x1: 0.65, y1: 0.8 });
      anchor = ex.render(st, rect).anchor;
      watchFrames(ex);
    }
    // Check 3 has an object of its own, the owner's PayPal account as Remedy reads it: its leader runs from there.
    const acct = st.beat === "acct" && st.callout > 0;
    if (account.current) {
      account.current.toggleAttribute("data-on", acct);
      if (acct) {
        const a = account.current.getBoundingClientRect();
        anchor = { x: a.right - stage.left, y: a.top - stage.top + a.height / 2 };
      }
    }
    // Leader: from the part to the callout's first line, drawn on like ink as the camera arrives on the part, and faded
    // out (never retracted, which left a segment hanging in mid-air) as the camera leaves it (model.ts), so it never
    // points into a moving frame.
    const box = calloutBox.current?.getBoundingClientRect();
    const path = leader.current;
    if (path && dot.current) {
      const vis = anchor && box && st.callout ? st.leader : 0;
      if (anchor && box && vis) {
        const tx = box.left - stage.left - 12;
        const ty = box.top - stage.top + 9;
        path.setAttribute("d", `M${anchor.x.toFixed(1)},${anchor.y.toFixed(1)} L${(tx - 18).toFixed(1)},${ty.toFixed(1)} L${tx.toFixed(1)},${ty.toFixed(1)}`);
        dot.current.setAttribute("cx", anchor.x.toFixed(1));
        dot.current.setAttribute("cy", anchor.y.toFixed(1));
      }
      path.style.strokeDashoffset = String(1 - st.leaderInk);
      path.style.opacity = vis ? String(st.leaderFade ** 2) : "0";
      dot.current.style.opacity = String(vis);
    }
    // The mask over the scene follows the camera onto the tag macro and off it (model.ts macroAt): there the top fade
    // starts lower, so the pillow's body is out of the picture and the tag, further down, is whole, and the left edge
    // fades later, so the left half's stuffing is gone rather than cut off. The fade stays soft (96px or more), and
    // only starts lower over the second half of the move, so mid-move the body never ends on a hard line.
    const late = Math.min(1, Math.max(0, (st.macro - 0.5) / 0.5));
    el.style.setProperty("--m-in", `${(4 + 84 * late * late * (3 - 2 * late)).toFixed(1)}px`);
    el.style.setProperty("--m-len", `${(128 - 32 * st.macro).toFixed(1)}px`);
    el.style.setProperty("--m-edge", `${(10 * st.macro).toFixed(2)}%`);
    // The callout is a state the CSS eases in time (360ms in, 180ms out), so a stop never rests on half-drawn words.
    if (calloutBox.current) calloutBox.current.toggleAttribute("data-on", st.callout > 0);
    if (receipt.current) {
      receipt.current.style.opacity = String(Math.min(1, st.receipt * RECEIPT_FADE));
      // It settles level, so its figures read crisp at rest.
      receipt.current.style.transform = `translateY(${((1 - st.receipt) * 48).toFixed(1)}px) rotate(${(1.6 * (1 - st.receipt)).toFixed(2)}deg)`;
    }
    // Active check's bar fills with its beat, full the moment its tick lands (tickAt), never after.
    el.querySelectorAll<HTMLElement>("[data-fill]").forEach((f) => {
      const id = CHECKS[Number(f.dataset.fill)].id;
      const a = RANGES[id][0];
      const t = Math.min(1, Math.max(0, (st.p - a) / (tickAt(id) - a)));
      f.style.transform = `scaleX(${t})`;
    });
    // Posters: the still of the beat p is in, switched at the beat's start, where the callout, readouts and check row
    // change, so the still and the callout always describe the same check. The switch dissolves in time (DISSOLVE), never
    // scrubbed: the upper still of the two fades in over the lower going down, and out off it going up, the lower held
    // whole under it, so the dissolve never dims to the ground and a page stopped anywhere rests on one still. Scrubbed
    // over 3% of a beat, a page stopped inside it showed two pillows and a ghost of the tag.
    if (posters.current && (!live || !scene.current)) {
      const on = POSTER_BEATS.indexOf(st.beat);
      const was = posters.current === shown.current.el ? shown.current.at : -1;
      if (on !== was) {
        const upper = Math.max(on, was);
        posters.current.querySelectorAll<HTMLElement>("[data-poster]").forEach((img, k) => {
          img.style.transition = was < 0 ? "none" : k === upper ? `opacity ${DISSOLVE}ms ease-out` : k === on ? "none" : `opacity 0s ${DISSOLVE}ms`;
          img.style.opacity = k === on ? "1" : "0";
        });
        shown.current = { el: posters.current, at: on };
      }
    }
  }, [p, live, watchFrames]);

  // One frame per change of p (scroll), theme or size; nothing at all while idle or off-screen.
  const raf = useRef(0);
  const visible = useRef(true);
  const schedule = useCallback(() => {
    if (raf.current || !visible.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      draw();
    });
  }, [draw]);
  useEffect(() => p.on("change", schedule), [p, schedule]);
  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      cancelAnimationFrame(probe.current);
      raf.current = probe.current = 0;
    },
    [],
  );

  // Theme: re-read the tokens when <html> changes theme or the OS scheme flips.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const apply = () => {
      const c = readColors(el);
      setDark(c.dark);
      scene.current?.setColors(c);
      schedule();
    };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class", "style"],
    });
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => {
      mo.disconnect();
      mq.removeEventListener("change", apply);
    };
  }, [schedule]);

  // Load three.js and build the scene once the stage is within about a viewport; pause while it is off-screen.
  useEffect(() => {
    const el = root.current;
    if (!el || !live) return;
    let cancelled = false;
    let started = false;
    const start = async () => {
      started = true;
      try {
        const { createExhibit } = await import("./scene");
        if (cancelled || !canvas.current) return;
        const c = readColors(el);
        const ex = await createExhibit(canvas.current, {
          tier: 2,
          colors: c,
          preserve: capture,
        });
        if (cancelled) return ex.dispose();
        scene.current = ex;
        const r = el.getBoundingClientRect();
        ex.resize(r.width, r.height, devicePixelRatio);
        // Quality tier: after two warm-up frames (texture uploads, the first shadow map), time four real frames. Over
        // 12 ms a frame drops to tier 1 (pixel ratio 1, 512 shadows, one fibre shell); over 28 ms at tier 1, posters.
        let tier: Tier = 2;
        const rect = { x0: 0.05, y0: 0.2, x1: 0.65, y1: 0.8 };
        const sample = [0, 3, 6, 4].map((b) => stateAt(holdOf(BEATS[b].id)));
        ex.bench(sample.slice(0, 2), rect);
        if (!capture) {
          let ms = ex.bench(sample, rect);
          el.dataset.ms = ms.toFixed(1);
          if (ms > 12) {
            tier = 1;
            ex.setTier(1);
            ex.resize(r.width, r.height, devicePixelRatio);
            ex.bench(sample.slice(0, 1), rect);
            ms = ex.bench(sample, rect);
            el.dataset.ms += ` / ${ms.toFixed(1)}`;
            if (ms > 28) {
              ex.dispose();
              scene.current = null;
              setFailed(true);
              return;
            }
          }
        }
        el.dataset.tier = String(tier);
        draw();
        setWarm(true);
      } catch (e) {
        // The posters stand in. In development, say why.
        if (process.env.NODE_ENV !== "production") console.error("Opened Exhibit: falling back to posters", e);
        if (!cancelled) setFailed(true);
      }
    };
    const near = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !started) void start();
      },
      { rootMargin: "100% 0px" },
    );
    const onScreen = new IntersectionObserver(([e]) => {
      visible.current = e.isIntersecting;
      if (e.isIntersecting) schedule();
    });
    near.observe(el);
    onScreen.observe(el);
    return () => {
      cancelled = true;
      near.disconnect();
      onScreen.disconnect();
      scene.current?.dispose();
      scene.current = null;
    };
  }, [live, capture, draw, schedule]);

  // A frame after every React commit, so the DOM the frame writes (leader, receipt, fills) is never stale.
  useEffect(() => schedule(), [s, schedule]);

  // Size: the canvas fills the stage. The scene fades out under the header, the check row and the callout column
  // (a CSS mask from their measured edges), so the evidence can never sit under text.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const head = el.querySelector(`.${styles.head}`)?.getBoundingClientRect();
      const foot = el.querySelector(`.${styles.foot}`)?.getBoundingClientRect();
      const side = el.querySelector(`.${styles.side}`)?.getBoundingClientRect();
      if (head) el.style.setProperty("--m-top", `${Math.round(head.bottom - r.top)}px`);
      if (foot) el.style.setProperty("--m-bot", `${Math.round(foot.top - r.top)}px`);
      if (side) el.style.setProperty("--m-side", `${Math.round(side.left - r.left)}px`);
      scene.current?.resize(r.width, r.height, devicePixelRatio);
      schedule();
    });
    ro.observe(el);
    // The header too: it can rewrap (the font swapping in) without the stage changing size.
    const headEl = el.querySelector(`.${styles.head}`);
    if (headEl) ro.observe(headEl);
    return () => ro.disconnect();
  }, [schedule]);

  // The capture tool drives the stage directly: window.__exhibit.at(p) draws that frame now.
  useEffect(() => {
    if (!capture) return;
    const w = window as unknown as { __exhibit?: unknown };
    w.__exhibit = {
      ready: () => !!scene.current,
      at: (v: number, rect?: Rect, shot?: Shot) => {
        rectOverride.current = rect ?? null;
        shotOverride.current = shot ?? null;
        p.set(v);
        draw();
      },
      bounds: () => scene.current?.bounds() ?? [],
      info: () => scene.current?.info(),
    };
  }, [capture, p, draw]);

  // The canvas only while live: once fallen back to the posters it is gone, never a frozen frame over them.
  const layers = stageLayers({ mode, failed, warm });
  const showPosters = layers.posters;
  const beatIndex = POSTER_BEATS.indexOf(s.beat);
  const postersEl = showPosters && (
    <div ref={posters} className={styles.posters} aria-hidden="true">
      {POSTER_BEATS.map((b, k) => (
        // eslint-disable-next-line @next/next/no-img-element -- pre-rendered stills, swapped by scroll; next/image adds nothing here
        <img
          key={b}
          data-poster={b}
          alt=""
          src={Math.abs(k - beatIndex) <= 1 ? posterSrc(b, dark, small) : undefined}
          style={{ opacity: k === beatIndex ? 1 : 0 }}
          decoding="async"
        />
      ))}
    </div>
  );

  return (
    <div ref={root} className={clsx(styles.stage, small && styles.small)} data-mode={live ? "live" : "poster"} data-beat={s.beat} data-warm={warm || undefined}>
      <div className={styles.pool} aria-hidden="true" />
      {!small && postersEl}
      {layers.canvas && <canvas ref={canvas} className={clsx(styles.canvas, layers.canvasOn && styles.canvasOn)} aria-hidden="true" />}
      <svg className={styles.leaders} aria-hidden="true">
        <path ref={leader} pathLength={1} />
        <circle ref={dot} r={2.5} />
      </svg>

      <div className={styles.layout}>
        <header className={styles.head}>
          <Header compact={small} />
          <Readouts s={s} />
        </header>
        <div className={styles.main}>
          <div ref={subject} className={styles.subject} aria-hidden="true">
            {small && postersEl}
            {!small && <AccountCard ref={account} />}
          </div>
          <div className={styles.side} aria-hidden="true">
            {/* A new check's words mount fresh and rise in; check 5's hold on into the payout. */}
            <div ref={calloutBox} key={s.beat === "paid" ? "torn" : s.beat} className={styles.calloutWrap}>
              <Callout s={s} />
            </div>
            {s.receipt > 0 && (
              <div ref={receipt} className={styles.receiptWrap}>
                <Receipt stamped={s.stamped} />
              </div>
            )}
          </div>
        </div>
        <footer className={styles.foot}>
          <div className={styles.footLine}>
            {skip}
          </div>
          <ol className={styles.row}>
            {CHECKS.map((c, i) => (
              <CheckCell key={c.id} i={i} done={i < s.done} active={i === s.active} onSeek={onSeek} />
            ))}
          </ol>
        </footer>
      </div>
      <ScreenReaderSummary />
    </div>
  );
}

// ---- The static form: reduced motion, no JS, and the server render.

function StaticExhibit({ chain }: { chain: boolean }) {
  return (
    <section className={styles.static} aria-label="How it works: five checks and the payout">
      <Header chapter={chain ? "Live photo, five checks, paid" : undefined} />
      <div className={styles.staticGrid}>
        <figure className={styles.staticFigure}>
          <div className={styles.pool} aria-hidden="true" />
          <picture>
            <source media="(max-width: 767px)" srcSet={posterSrc("paid", true, true)} />
            <img
              className={styles.onDark}
              src={posterSrc("paid", true, false)}
              alt="The X-VESOLJE Nursing Pillow, cut in half, with its paper tag reading X-VESOLJE M4T."
            />
          </picture>
          <picture>
            <source media="(max-width: 767px)" srcSet={posterSrc("paid", false, true)} />
            <img className={styles.onLight} src={posterSrc("paid", false, false)} alt="" aria-hidden="true" />
          </picture>
        </figure>
        <ol className={clsx(styles.staticChecks, "flex flex-col")}>
            {CHECKS.map((c) => (
            <li key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 border-t border-line py-4">
              <div>
                <p className="text-body font-medium">{c.label}</p>
                <p className="mt-1 text-ui text-muted">{c.note}</p>
                {c.quote && <blockquote className="mt-3 text-ui leading-[1.55] text-muted">“{c.quote}”</blockquote>}
              </div>
              <span className="text-pay">
                <CheckIcon />
                <span className="sr-only">passed</span>
              </span>
            </li>
            ))}
        </ol>
        <Receipt stamped className={styles.staticReceipt} />
      </div>
    </section>
  );
}

// ---- The exported component.

export interface OpenedExhibitProps {
  /**
   * Claim progress, 0 to 1, from the parent's own pin (the Chain of Custody's chapters 03 to 05). The exhibit then fills
   * its parent and does not pin itself. Without it, the exhibit is its own pinned section of TOTAL_VH + 100vh.
   */
  progress?: MotionValue<number>;
  /** With `progress`: called when a check is chosen in the row, with the p that shows it. */
  onSeek?: (p: number) => void;
  /** With `progress`: the pin's skip link, shown in the exhibit's own foot (it covers the pin's rail). */
  skip?: ReactNode;
  /**
   * Mounted in a numbered sequence (the Chain of Custody). The static form, which the sequence's static figures number
   * around, names its chapters 03 to 05; the pinned and phone forms' eyebrow is the section's name, as the rail's is.
   */
  chapters?: number;
  /** Dev and capture only (the /dev/teardown page). */
  capture?: boolean;
}

function SelfPinned({ mode, small, capture }: { mode: "live" | "poster"; small: boolean; capture?: boolean }) {
  const runway = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: runway as RefObject<HTMLElement>,
    offset: ["start start", "end end"],
  });
  const skipId = useId();
  const seek = (i: number) => {
    const el = runway.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + scrollY;
    const travel = el.offsetHeight - innerHeight;
    scrollTo({ top: top + holdOf(CHECKS[i].id) * travel, behavior: "instant" });
  };
  const vh = small ? Math.round(TOTAL_VH * 0.8) : TOTAL_VH;
  return (
    <section
      ref={runway}
      className={styles.runway}
      style={{ height: `calc(${vh}vh + 100svh)` }}
      aria-label="How it works: five checks and the payout"
      data-exhibit-runway
    >
      <a href={`#${skipId}-after`} className={styles.skip}>
        Skip the five checks
      </a>
      <div className={styles.sticky}>
        <Stage p={scrollYProgress} mode={mode} small={small} onSeek={seek} capture={capture} />
      </div>
      <span id={`${skipId}-after`} className={styles.after} tabIndex={-1} />
    </section>
  );
}

export function OpenedExhibit({ progress, onSeek, skip, chapters, capture }: OpenedExhibitProps) {
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const reduce = useMedia("(prefers-reduced-motion: reduce)", true);
  const small = useMedia("(max-width: 767px)", false);
  const gl = useSyncExternalStore(noop, hasWebGL, () => false);
  // The capture page always draws live, at any size: it renders the posters the other forms show.
  const mode: Mode = capture && hydrated ? "live" : !hydrated || reduce ? "static" : small || !gl ? "poster" : "live";

  if (mode === "static") return <StaticExhibit chain={chapters !== undefined} />;
  if (progress)
    return (
      <div className="relative h-full w-full">
        <Stage
          p={progress}
          mode={mode}
          small={small && !capture}
          capture={capture}
          skip={skip}
          onSeek={onSeek ? (i) => onSeek(holdOf(CHECKS[i].id)) : undefined}
        />
      </div>
    );
  return <SelfPinned mode={mode} small={small} capture={capture} />;
}
