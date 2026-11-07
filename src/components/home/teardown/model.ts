// The Opened Exhibit's one input: claim progress p in [0, 1] for claim RM-0442. Every pose, camera shot, readout,
// tick and callout is a pure function of p (no time, no state), so the pinned scroll, the poster stills and the tests
// all see the same frame for the same p. No three.js in here.

import { CHECKS, EXHIBIT, type CheckId } from "./claim";

export type BeatId = "intro" | CheckId | "paid" | "settle";

/**
 * Beats and their share of the pin, in vh of scroll (about 500vh in all, so about 70vh a beat). The code check is the
 * signature shot and holds longest; the verified account has no physical part and is the shortest.
 */
export const BEATS: readonly { id: BeatId; vh: number }[] = [
  { id: "intro", vh: 50 },
  { id: "live", vh: 65 },
  { id: "fp", vh: 65 },
  { id: "acct", vh: 40 },
  { id: "code", vh: 95 },
  { id: "torn", vh: 70 },
  { id: "paid", vh: 85 },
  { id: "settle", vh: 30 },
];

export const TOTAL_VH = BEATS.reduce((a, b) => a + b.vh, 0);

/** Each beat's [start, end] in p. */
export const RANGES: Record<BeatId, readonly [number, number]> = (() => {
  let at = 0;
  const out = {} as Record<BeatId, readonly [number, number]>;
  for (const b of BEATS) {
    out[b.id] = [at / TOTAL_VH, (at + b.vh) / TOTAL_VH];
    at += b.vh;
  }
  return out;
})();

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const inv = (a: number, b: number, x: number) => clamp01((x - a) / (b - a));
export const easeOut = (x: number) => 1 - (1 - x) ** 4;
export const easeInOut = (x: number) => (x < 0.5 ? 8 * x ** 4 : 1 - (-2 * x + 2) ** 4 / 2);
export const smooth = (x: number) => x * x * (3 - 2 * x);
const lerp = (a: number, b: number, x: number) => a + (b - a) * x;

/** Where p sits inside a beat, 0 to 1. */
export const local = (id: BeatId, p: number) => inv(RANGES[id][0], RANGES[id][1], p);

/** A part opens over the first 22% of its beat, holds, and closes over the last 12% (about 1 s, hold, 0.5 s). */
export function opened(id: BeatId, p: number) {
  const t = local(id, p);
  if (p < RANGES[id][0] || p > RANGES[id][1]) return 0;
  return easeOut(inv(0, 0.22, t)) * (1 - easeInOut(inv(0.88, 1, t)));
}

/** A check ticks at 82% of its beat. */
const tickAt = (id: CheckId) => lerp(RANGES[id][0], RANGES[id][1], 0.82);

/**
 * Seconds since the photo, as claim RM-0442 ran: the three pre-checks take under a second, the model reads the photo
 * until about 0:14, and the payout is sent at 0:15.
 */
export function elapsed(p: number) {
  if (p < RANGES.live[0] + (RANGES.live[1] - RANGES.live[0]) * 0.55) return null; // the photo is taken mid-scan
  if (p < RANGES.code[0]) return Math.min(1, 1 * inv(RANGES.fp[0], RANGES.acct[1], p));
  if (p < RANGES.paid[0]) return lerp(1, 14, inv(RANGES.code[0], RANGES.torn[1], p));
  return lerp(14, EXHIBIT.seconds, inv(RANGES.paid[0], RANGES.paid[0] + 0.25 * (RANGES.paid[1] - RANGES.paid[0]), p));
}

export const clock = (s: number | null) => (s === null ? "—" : `0:${String(Math.floor(s)).padStart(2, "0")}`);

/** A camera shot: orbit angles (degrees, az 0 looks from the front), what it aims at, and how much it must hold. */
export interface Shot {
  az: number;
  el: number;
  /** The aim point, metres. */
  at: readonly [number, number, number];
  /** Half-width and half-height of the subject (metres) that must fit inside the subject rect. */
  rx: number;
  ry: number;
}

/** The front three-quarter hero view of the whole evidence, the opening and closing frame. */
export const HERO: Shot = {
  az: 16,
  el: 30,
  at: [0.03, 0.05, 0.07],
  rx: 0.41,
  ry: 0.27,
};

/** Each beat's shot, held while its part hangs open. The camera pushes in 6% over the hold. */
export const SHOTS: Record<BeatId, Shot> = {
  intro: HERO,
  // Behind and above the owner's phone: the phone in the foreground, its frustum running out to the evidence.
  live: { az: 8, el: 34, at: [0.0, 0.16, 0.2], rx: 0.42, ry: 0.32 },
  // The print, held up out to the left; from this side the pillow is out of the frame and the earlier prints stack
  // behind it.
  fp: { az: 28, el: 8, at: [-0.9, 0.23, 0.02], rx: 0.24, ry: 0.17 },
  // No physical part: the hero view, a touch higher, while the panel does the work.
  acct: { az: 18, el: 34, at: [0.02, 0.05, 0.05], rx: 0.44, ry: 0.3 },
  // Macro on the tag, square to its face (it lies at 36 degrees once the halves have spread), so M, 4 and T read.
  code: { az: 36, el: 64, at: [0.29, 0.06, 0.29], rx: 0.11, ry: 0.08 },
  // Low and from the front left, onto the right half's cut face as the halves part.
  torn: { az: -20, el: 15, at: [0.02, 0.05, 0.16], rx: 0.44, ry: 0.17 },
  // Pulled back for the rule and the explode, on a slow turntable.
  paid: { az: 24, el: 26, at: [0.02, 0.06, 0.06], rx: 0.52, ry: 0.32 },
  settle: HERO,
};

/** Camera keys in p: each beat arrives at 22% of its range and holds to 88%, pushing in. */
const KEYS: { p: number; shot: Shot }[] = (() => {
  const keys: { p: number; shot: Shot }[] = [{ p: 0, shot: HERO }];
  for (const b of BEATS) {
    const [a, z] = RANGES[b.id];
    const s = SHOTS[b.id];
    const push = b.id === "intro" || b.id === "settle" ? 1 : 0.94;
    keys.push({ p: lerp(a, z, 0.22), shot: s });
    keys.push({
      p: lerp(a, z, 0.88),
      shot: { ...s, rx: s.rx * push, ry: s.ry * push },
    });
  }
  keys.push({ p: 1, shot: HERO });
  return keys;
})();

/** The shot at p, eased between keys. The paid beat adds a slow turntable (+-40 degrees). */
export function shotAt(p: number): Shot {
  let i = 0;
  while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const x = easeInOut(inv(a.p, b.p, p));
  const shot: Shot = {
    az: lerp(a.shot.az, b.shot.az, x),
    el: lerp(a.shot.el, b.shot.el, x),
    at: [lerp(a.shot.at[0], b.shot.at[0], x), lerp(a.shot.at[1], b.shot.at[1], x), lerp(a.shot.at[2], b.shot.at[2], x)],
    rx: lerp(a.shot.rx, b.shot.rx, x),
    ry: lerp(a.shot.ry, b.shot.ry, x),
  };
  shot.az += -40 * Math.sin(Math.PI * smooth(inv(RANGES.paid[0] + 0.004, RANGES.paid[1], p)));
  return shot;
}

export type Decision = "waiting" | "checking" | "pay";

/** Everything one frame shows. */
export interface ExhibitState {
  p: number;
  beat: BeatId;
  /** 0 = whole pillow, 1 = cut and parted as in the photo. */
  cut: number;
  /** How far each part is open, 0 to 1. */
  live: number;
  fp: number;
  code: number;
  torn: number;
  /** The paid beat's explode, 0 to 1 and back. */
  explode: number;
  /** The scan plane's sweep across the evidence, 0 to 1 (live check). */
  scan: number;
  /** The fingerprint grid drawing on (photo check). */
  hash: number;
  /** Code characters read so far (0 to 3) and the one being read now (-1 for none). */
  chars: number;
  charNow: number;
  /** Index of the check being shown (0 to 4), or -1. */
  active: number;
  /** How visible the active check's callout is. */
  callout: number;
  /** Checks passed so far. */
  done: number;
  seconds: number | null;
  decision: Decision;
  /** The receipt's slide (0 to 1) and whether its stamp has landed. */
  receipt: number;
  stamped: boolean;
  sent: boolean;
  shot: Shot;
}

const CHECK_IDS = CHECKS.map((c) => c.id);

export function stateAt(pIn: number): ExhibitState {
  const p = clamp01(pIn);
  const beat = BEATS.find((b) => p <= RANGES[b.id][1])?.id ?? "settle";
  const active = CHECK_IDS.indexOf(beat as CheckId);
  const done = CHECK_IDS.filter((id) => p >= tickAt(id)).length;
  const codeT = local("code", p);
  const chars = p < RANGES.code[0] ? 0 : p > RANGES.code[1] ? 3 : [0.3, 0.44, 0.58].filter((t) => codeT >= t).length;
  const charNow = p >= RANGES.code[0] && p <= RANGES.code[1] && codeT < 0.8 ? chars - 1 : -1;
  const paidT = local("paid", p);
  const ruled = p >= RANGES.paid[0] + 0.12 * (RANGES.paid[1] - RANGES.paid[0]);
  return {
    p,
    beat,
    cut: easeOut(inv(RANGES.intro[0] + 0.02, RANGES.intro[1] - 0.01, p)),
    live: opened("live", p),
    fp: opened("fp", p),
    code: opened("code", p),
    torn: opened("torn", p),
    explode: Math.sin(Math.PI * smooth(inv(0.05, 0.95, paidT))) * (p >= RANGES.paid[0] && p <= RANGES.paid[1] ? 1 : 0),
    scan: inv(0.3, 0.75, local("live", p)),
    hash: smooth(inv(0.25, 0.6, local("fp", p))),
    chars,
    charNow,
    active,
    callout: active >= 0 ? opened(beat, p) : 0,
    done,
    seconds: elapsed(p),
    decision: ruled ? "pay" : elapsed(p) === null ? "waiting" : "checking",
    receipt: p < RANGES.paid[0] ? 0 : easeOut(inv(0.18, 0.42, paidT)),
    stamped: p >= RANGES.paid[0] && paidT >= 0.48,
    sent: p >= lerp(RANGES.paid[0], RANGES.paid[1], 0.25),
    shot: shotAt(p),
  };
}

/** The p each beat is best seen at (the middle of its hold), for posters, the check buttons and tests. */
export function holdOf(id: BeatId) {
  const [a, z] = RANGES[id];
  if (id === "intro") return z - 0.002;
  if (id === "settle") return 1;
  if (id === "paid") return lerp(a, z, 0.62);
  return lerp(a, z, 0.6);
}
