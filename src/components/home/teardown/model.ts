// The Opened Exhibit's one input: claim progress p in [0, 1] for claim RM-0442. Every pose, camera shot, readout,
// tick and callout is a pure function of p (no time, no state), so the pinned scroll, the poster stills and the tests
// all see the same frame for the same p. No three.js in here.

import { CHECKS, EXHIBIT, type CheckId } from "./claim";

export type BeatId = "intro" | CheckId | "paid";

/**
 * Beats and their share of the pin, in vh of scroll: 520vh in all, and no beat under DESIGN.md's 70vh floor. The code
 * check and the payout are the signature shots and hold longest. The exhibit ends on the paid pose: the pin cuts to
 * the console from there, so a return to the hero view would never be seen.
 */
export const BEATS: readonly { id: BeatId; vh: number }[] = [
  { id: "intro", vh: 70 },
  { id: "live", vh: 70 },
  { id: "fp", vh: 70 },
  { id: "acct", vh: 70 },
  { id: "code", vh: 85 },
  { id: "torn", vh: 70 },
  { id: "paid", vh: 85 },
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
/** DESIGN.md's state-to-state curve, cubic-bezier(0.65, 0, 0.35, 1): the camera's moves between beats. Its peak speed is
 * 1.5x the average (the quartic's was 2x), so a move spreads over its whole window instead of whipping past mid-way. */
export const inOutCubic = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
const lerp = (a: number, b: number, x: number) => a + (b - a) * x;

/** Where p sits inside a beat, 0 to 1. */
export const local = (id: BeatId, p: number) => inv(RANGES[id][0], RANGES[id][1], p);

/** A part opens over the first 22% of its beat, holds, and closes over the last 12% (about 1 s, hold, 0.5 s). */
export function opened(id: BeatId, p: number) {
  const t = local(id, p);
  if (p < RANGES[id][0] || p > RANGES[id][1]) return 0;
  return easeOut(inv(0, 0.22, t)) * (1 - easeInOut(inv(0.88, 1, t)));
}

/**
 * The prints (check 2) are held out to the left, where the pillow is out of the frame. If they closed with their beat,
 * the frame would be empty while the camera travels back to the pillow, so they stay open into the next beat and
 * close over its first 12%, gone before the camera's move carries them off the frame's left edge.
 */
function fpOpen(p: number) {
  if (p <= RANGES.fp[1]) return p < RANGES.fp[0] ? 0 : easeOut(inv(0, 0.22, local("fp", p)));
  return 1 - easeInOut(inv(0, 0.12, local("acct", p)));
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
  // The whole cut pillow with the owner's phone held off its front right, between it and the callout: the phone's
  // frustum runs out toward the cut and stops short of it, so the phone reads as a camera taking the photo, never as a
  // phone lying on the pillow (scene/parts.ts poses it).
  live: { az: 8, el: 30, at: [0.11, 0.12, 0.12], rx: 0.52, ry: 0.29 },
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
};

/** Camera keys in p: each beat arrives at 22% of its range and holds to 88%, pushing in. */
const KEYS: { p: number; shot: Shot }[] = (() => {
  const keys: { p: number; shot: Shot }[] = [{ p: 0, shot: HERO }];
  for (const b of BEATS) {
    const [a, z] = RANGES[b.id];
    const s = SHOTS[b.id];
    const push = b.id === "intro" ? 1 : 0.94;
    keys.push({ p: lerp(a, z, 0.22), shot: s });
    keys.push({
      p: lerp(a, z, 0.88),
      shot: { ...s, rx: s.rx * push, ry: s.ry * push },
    });
  }
  return keys;
})();

/** The two camera keys p sits between, and how far it is from the first to the second (0 to 1, eased). */
function keysAt(p: number) {
  let i = 0;
  while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++;
  return { a: KEYS[i].shot, b: KEYS[i + 1].shot, x: inOutCubic(inv(KEYS[i].p, KEYS[i + 1].p, p)) };
}

/** How far the camera pulls back mid-move, per metre the aim travels, as extra half-width (metres). */
const PULL = 0.5;
/** The most a move may pull back past the wider of its two shots. */
const PULL_MAX = 0.45;

/**
 * The shot at p, eased between keys. A move between two distant subjects pulls back as it goes (more the further the
 * aim travels, none at either end), so a reader who stops mid-move sees both subjects whole, never a close-up of the
 * empty floor between them. The paid beat adds a slow turntable (+-40 degrees).
 */
export function shotAt(p: number): Shot {
  const { a, b, x } = keysAt(p);
  const span = Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1], a.at[2] - b.at[2]);
  const rx = lerp(a.rx, b.rx, x);
  // sin squared: the most pull-back mid-move, little as the camera settles onto a close shot (the tag macro).
  const pull = Math.min(Math.sin(Math.PI * x) ** 2 * PULL * span, Math.max(0, Math.max(a.rx, b.rx) + PULL_MAX - rx));
  const shot: Shot = {
    az: lerp(a.az, b.az, x),
    el: lerp(a.el, b.el, x),
    at: [lerp(a.at[0], b.at[0], x), lerp(a.at[1], b.at[1], x), lerp(a.at[2], b.at[2], x)],
    rx: rx + pull,
    ry: lerp(a.ry, b.ry, x) + 0.65 * pull,
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
  /** How visible the side callout is: the active check's, or in the intro the photo being framed. */
  callout: number;
  /**
   * The leader from the part to the callout, drawn on like ink (0 to 1): only once the camera has nearly arrived on the
   * part (12% to 22% of its beat), and gone as the part closes, so it never points into a moving frame.
   */
  leader: number;
  /** How close the camera is to the tag macro (0 to 1), easing with the camera: the stage's mask follows it. */
  macro: number;
  /** In the intro, how many of the three things the photo must show are in the frame so far (0 to 3). */
  framed: number;
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

/** The receipt is opaque by a third of its slide, and check 5's words under it leave as fast: a short handover. */
export const RECEIPT_FADE = 3;
/** The receipt's slide in the paid beat: in from 2% of it, landing at 24%, as the camera arrives on the paid shot. */
const receiptAt = (p: number) => (p < RANGES.paid[0] ? 0 : easeOut(inv(0.02, 0.24, local("paid", p))));

/**
 * The side callout's opacity. The intro's opens with the cut; each check's then holds through the hand-off and the next
 * one cuts in over the first 5% of its beat, so the outgoing words stay until the incoming ones replace them and the
 * column is never blank between checks. The last check's holds into the payout and leaves as the receipt lands over it.
 */
function calloutAt(beat: BeatId, p: number) {
  const t = local(beat, p);
  if (beat === "intro") return easeOut(inv(0, 0.22, t));
  if (beat === "paid") return Math.max(0, 1 - receiptAt(p) * RECEIPT_FADE);
  return easeOut(inv(0, 0.05, t));
}

/** The leader's ink: a check's part has its leader from 12% to 22% of its beat until it starts closing at 88%. */
function leaderAt(beat: BeatId, p: number) {
  if (!CHECK_IDS.includes(beat as CheckId)) return 0;
  const t = local(beat, p);
  return smooth(inv(0.12, 0.22, t)) * (1 - easeInOut(inv(0.88, 1, t)));
}

/**
 * How close the camera is to the tag macro: 0 until the move onto it starts (acct 88%), easing with the camera to 1 at
 * code 22%, holding, and back to 0 as the camera arrives on the cut (torn 22%).
 */
function macroAt(p: number) {
  const { a, b, x } = keysAt(p);
  const k = (s: Shot) => (s.at === SHOTS.code.at ? 1 : 0);
  return lerp(k(a), k(b), x);
}

/** Where in the intro each thing the photo must show comes into the frame: the tag, the cut, the code. */
const FRAMED_AT = [0.3, 0.5, 0.7];

export function stateAt(pIn: number): ExhibitState {
  const p = clamp01(pIn);
  const beat = BEATS.find((b) => p <= RANGES[b.id][1])?.id ?? "paid";
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
    fp: fpOpen(p),
    code: opened("code", p),
    torn: opened("torn", p),
    explode: Math.sin(Math.PI * smooth(inv(0.05, 0.95, paidT))) * (p >= RANGES.paid[0] && p <= RANGES.paid[1] ? 1 : 0),
    scan: inv(0.3, 0.75, local("live", p)),
    hash: smooth(inv(0.25, 0.6, local("fp", p))),
    chars,
    charNow,
    active,
    // The intro has a callout too (the photo being framed), so the side column is never empty while the pillow is cut.
    callout: calloutAt(beat, p),
    leader: leaderAt(beat, p),
    macro: macroAt(p),
    framed: p > RANGES.intro[1] ? 3 : FRAMED_AT.filter((t) => local("intro", p) >= t).length,
    done,
    seconds: elapsed(p),
    decision: ruled ? "pay" : elapsed(p) === null ? "waiting" : "checking",
    receipt: receiptAt(p),
    stamped: p >= RANGES.paid[0] && paidT >= 0.3,
    sent: p >= lerp(RANGES.paid[0], RANGES.paid[1], 0.25),
    shot: shotAt(p),
  };
}

/** The p each beat is best seen at (the middle of its hold), for posters, the check buttons and tests. */
export function holdOf(id: BeatId) {
  const [a, z] = RANGES[id];
  if (id === "intro") return z - 0.002;
  if (id === "paid") return lerp(a, z, 0.62);
  return lerp(a, z, 0.6);
}
