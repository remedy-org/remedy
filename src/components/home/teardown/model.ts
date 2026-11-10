// The Opened Exhibit's one input: claim progress p in [0, 1] for claim RM-0442. Every pose, camera shot, readout,
// tick and callout is a pure function of p (no time, no state), so the pinned scroll, the poster stills and the tests
// all see the same frame for the same p. No three.js in here.

import { CHECKS, EXHIBIT, type CheckId } from "./claim";

export type BeatId = "intro" | CheckId | "paid";

/**
 * Beats and their share of the pin, in vh of scroll: 500vh in all, and no beat under DESIGN.md's 70vh floor. The code
 * check is the signature shot and holds longest; every hold keeps the camera moving (HOLD_PUSH). The exhibit ends on the paid pose: the pin cuts to
 * the console from there, so a return to the hero view would never be seen.
 */
export const BEATS: readonly { id: BeatId; vh: number }[] = [
  { id: "intro", vh: 70 },
  { id: "live", vh: 70 },
  { id: "fp", vh: 70 },
  { id: "acct", vh: 70 },
  { id: "code", vh: 80 },
  { id: "torn", vh: 70 },
  { id: "paid", vh: 70 },
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

/** A part opens as the camera arrives on it (ARRIVE), holds, and closes over the last 12% (about 1 s, hold, 0.5 s). */
export function opened(id: BeatId, p: number) {
  const t = local(id, p);
  if (p < RANGES[id][0] || p > RANGES[id][1]) return 0;
  return easeOut(inv(0, ARRIVE[id], t)) * (1 - easeInOut(inv(0.88, 1, t)));
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

/** A check ticks at 82% of its beat, or before the camera leaves it; its bar in the row fills up to that moment. */
export const tickAt = (id: CheckId) => lerp(RANGES[id][0], RANGES[id][1], Math.min(0.82, DEPART[id] - 0.04));

/**
 * Claim RM-0442's one timeline, as the console gives it (claim.ts EXHIBIT; custody/claim.test.ts holds it to the
 * dataset's events), placed on the pin. The three pre-checks are done by EXHIBIT.prechecked (0.3 s), a tenth of a
 * second each as their ticks land; the model reads the photo from there until it answers at EXHIBIT.answered (11.3 s),
 * as check 5 ticks, and the rule approves it at that instant. The payout is sent at EXHIBIT.seconds (15 s) as the paid
 * beat opens, and PayPal confirms it at EXHIBIT.confirmed (55 s): only then does the payout read Paid, and the receipt
 * print its confirmation and take the PAID stamp. So the clock moves from the first check on, never parked at 0:00
 * while checks pass, and never shows Paid beside a payout still on its way.
 */
/** Where in the paid beat the payout is sent (the receipt starts to feed out) and where PayPal confirms it. */
export const SENT_AT = 0.04;
export const CONFIRMED_AT = 0.48;
const clockPoints = (): readonly (readonly [number, number])[] => [
  [RANGES.live[0] + (RANGES.live[1] - RANGES.live[0]) * 0.55, 0], // the photo is taken mid-beat
  [tickAt("live"), EXHIBIT.prechecked / 3],
  [tickAt("fp"), (2 * EXHIBIT.prechecked) / 3],
  [tickAt("acct"), EXHIBIT.prechecked],
  [tickAt("torn"), EXHIBIT.answered],
  // Held at the answer while the camera stays on the cut, so check 5's stop reads the console's answer time.
  [lerp(RANGES.torn[0], RANGES.torn[1], DEPART.torn), EXHIBIT.answered],
  [lerp(RANGES.paid[0], RANGES.paid[1], SENT_AT), EXHIBIT.seconds],
  [lerp(RANGES.paid[0], RANGES.paid[1], CONFIRMED_AT), EXHIBIT.confirmed],
];

export function elapsed(p: number) {
  const CLOCK = clockPoints();
  if (p < CLOCK[0][0]) return null;
  for (let i = 1; i < CLOCK.length; i++) if (p < CLOCK[i][0]) return lerp(CLOCK[i - 1][1], CLOCK[i][1], inv(CLOCK[i - 1][0], CLOCK[i][0], p));
  return EXHIBIT.confirmed;
}

/** The time since the photo to the nearest tenth, "0:00.2", so the pre-checks' fractions of a second show as they pass
 * and the answer reads 0:11.3, as the console's "answered in 11.3 s". */
export function clock(s: number | null) {
  if (s === null) return "—";
  const tenths = Math.round(s * 10);
  return `0:${String(Math.floor(tenths / 10)).padStart(2, "0")}.${tenths % 10}`;
}

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

/** Each beat's shot, held while its part hangs open. Over the hold the camera keeps moving, at an even pace, so every
 * turn of the wheel moves the frame: it pushes in 12% and turns 3 degrees round the part (HOLD_PUSH, HOLD_TURN). */
export const SHOTS: Record<BeatId, Shot> = {
  intro: HERO,
  // The whole cut pillow with the owner's phone held off its front right, between it and the callout, its screen toward
  // the viewer with the photo it took, so it reads as the camera that took it, never as a phone lying on the pillow
  // (scene/parts.ts poses it).
  live: { az: 28, el: 30, at: [0.11, 0.12, 0.12], rx: 0.52, ry: 0.29 },
  // The print, held up out to the left; from this side the pillow is out of the frame and the earlier prints stack
  // behind it.
  fp: { az: 28, el: 8, at: [-0.9, 0.23, 0.02], rx: 0.24, ry: 0.17 },
  // No physical part: the hero view, a touch higher, while the panel does the work.
  acct: { az: 18, el: 34, at: [0.02, 0.05, 0.05], rx: 0.44, ry: 0.3 },
  // Macro on the tag, square to its face (it lies at 36 degrees once the halves have spread), so M, 4 and T read. Aimed
  // a little low and steep, so the pillow's underside is out of the frame above the tag, never a grey smear there.
  code: { az: 36, el: 76, at: [0.29, 0.05, 0.26], rx: 0.11, ry: 0.08 },
  // Low and from the front left, onto the right half's cut face as the halves part.
  torn: { az: -20, el: 15, at: [0.02, 0.05, 0.16], rx: 0.44, ry: 0.17 },
  // Pulled back for the rule and the explode, on a slow turntable.
  paid: { az: 24, el: 26, at: [0.02, 0.06, 0.06], rx: 0.52, ry: 0.32 },
};

/**
 * Where in its beat the camera arrives on each shot, and where it leaves for the next: 22% and 88%, except around the
 * tag macro. The moves onto it and off it change the framing most (the whole pillow to a 4x close-up of the tag), so
 * they get about 380px of wheel instead of about 250: the camera leaves acct and code at 80%, and arrives on code and
 * on the cut at 36%.
 */
export const ARRIVE: Record<BeatId, number> = { intro: 0.22, live: 0.22, fp: 0.22, acct: 0.22, code: 0.36, torn: 0.36, paid: 0.22 };
export const DEPART: Record<BeatId, number> = { intro: 0.88, live: 0.88, fp: 0.88, acct: 0.8, code: 0.8, torn: 0.88, paid: 0.88 };

/** How far the camera pushes in over a beat's hold (a share of the shot's half-width), and how far it turns (degrees). */
const HOLD_PUSH = 0.88;
const HOLD_TURN = 3;

/** Camera keys in p: each beat arrives at ARRIVE and holds to DEPART, pushing in and turning a little. */
const KEYS: { p: number; shot: Shot }[] = (() => {
  const keys: { p: number; shot: Shot }[] = [{ p: 0, shot: HERO }];
  for (const b of BEATS) {
    const [a, z] = RANGES[b.id];
    const s = SHOTS[b.id];
    const push = b.id === "intro" ? 1 : HOLD_PUSH;
    const turn = b.id === "intro" ? 0 : HOLD_TURN;
    keys.push({ p: lerp(a, z, ARRIVE[b.id]), shot: s });
    keys.push({
      p: lerp(a, z, DEPART[b.id]),
      shot: { ...s, az: s.az + turn, rx: s.rx * push, ry: s.ry * push },
    });
  }
  return keys;
})();

/**
 * The two camera keys p sits between, and how far it is from the first to the second (0 to 1): eased for a move between
 * two shots, even over a hold (the odd segments, arrive to depart), so a slow reader's every wheel tick moves the frame
 * as much as the last.
 */
function keysAt(p: number) {
  let i = 0;
  while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++;
  const x = inv(KEYS[i].p, KEYS[i + 1].p, p);
  return { a: KEYS[i].shot, b: KEYS[i + 1].shot, x: i % 2 === 1 ? x : inOutCubic(x) };
}

/** How far the camera pulls back mid-move, per metre the aim travels, as extra half-width (metres). */
const PULL = 0.5;
/** The most a move may pull back past the wider of its two shots. */
const PULL_MAX = 0.45;
/** How far a move pulls back per unit of zoom it changes (|ln| of the two half-widths' ratio), as extra half-width. */
const PULL_ZOOM = 0.12;

/**
 * The shot at p, eased between keys. A move between two distant subjects pulls back as it goes (more the further the
 * aim travels, none at either end), so a reader who stops mid-move sees both subjects whole, never a close-up of the
 * empty floor between them. The paid beat adds a slow turntable (+-40 degrees).
 */
export function shotAt(p: number): Shot {
  const { a, b, x } = keysAt(p);
  const span = Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1], a.at[2] - b.at[2]);
  const rx = lerp(a.rx, b.rx, x);
  // sin squared: the most pull-back mid-move, little as the camera settles onto a close shot (the tag macro). A big
  // change of zoom pulls back too, so the move onto the macro shows the whole pillow mid-way, never a crop of its body.
  const wide = PULL * span + PULL_ZOOM * Math.abs(Math.log(a.rx / b.rx));
  const pull = Math.min(Math.sin(Math.PI * x) ** 2 * wide, Math.max(0, Math.max(a.rx, b.rx) + PULL_MAX - rx));
  // Mid-move the aim leans toward the middle of both subjects together, not the middle of their two aim points, so a
  // wide subject (the whole pillow) next to a small one (the prints) is centred with it rather than cut by the side.
  const union = (Math.min(a.at[0] - a.rx, b.at[0] - b.rx) + Math.max(a.at[0] + a.rx, b.at[0] + b.rx)) / 2;
  const lean = (union - (a.at[0] + b.at[0]) / 2) * Math.sin(Math.PI * x) ** 2;
  const shot: Shot = {
    az: lerp(a.az, b.az, x),
    el: lerp(a.el, b.el, x),
    at: [lerp(a.at[0], b.at[0], x) + lean, lerp(a.at[1], b.at[1], x), lerp(a.at[2], b.at[2], x)],
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
  /** The paid beat's explode, 0 to 1, held to the end. */
  explode: number;
  /** The fingerprint grid drawing on (photo check). */
  hash: number;
  /** Code characters read so far (0 to 3) and the one being read now (-1 for none). */
  chars: number;
  charNow: number;
  /** Index of the check being shown (0 to 4), or -1. */
  active: number;
  /** Whether the side callout is up (0 or 1; the stage eases it in time): the active check's, or the intro's. */
  callout: number;
  /**
   * The leader from the part to the callout (0 to 1): drawn on like ink only as the camera arrives on the part, faded
   * out as the camera leaves it, so it never points into a moving frame. `leader` is ink times fade.
   */
  leader: number;
  leaderInk: number;
  leaderFade: number;
  /** How close the camera is to the tag macro (0 to 1), easing with the camera: the stage's mask follows it. */
  macro: number;
  /** In the intro, how many of the three things the photo must show are in the frame so far (0 to 3). */
  framed: number;
  /** Checks passed so far. */
  done: number;
  seconds: number | null;
  decision: Decision;
  /** The receipt's slide (0 to 1). */
  receipt: number;
  /** The payout sent (15 s), and PayPal's confirmation (55 s): the payout reads Paid, and the receipt prints its
   * confirmation row and takes the PAID stamp, only from then. */
  sent: boolean;
  stamped: boolean;
  shot: Shot;
}

const CHECK_IDS = CHECKS.map((c) => c.id);

/** The receipt is opaque by a third of its slide, and check 5's words under it leave as fast: a short handover. */
export const RECEIPT_FADE = 3;
/** The receipt's slide in the paid beat: in as the payout is sent (SENT_AT), landing 22% later, as the camera arrives on
 * the paid shot. */
const receiptAt = (p: number) => (p < RANGES.paid[0] ? 0 : easeOut(inv(SENT_AT, SENT_AT + 0.22, local("paid", p))));

/**
 * Whether the side callout is up (1) or down (0): a state, not a fade, so the stage animates it in time and a reader
 * who stops never rests on half-drawn words. The intro's is up from the beat's first frame, with the pillow, so the side
 * column is never empty beside it. Each check's is
 * up from its beat's first frame: the outgoing words hold to the hand-off and the next ones cut in there, so the column
 * is never blank between checks. The last check's holds into the payout and goes as the receipt is half opaque over it.
 */
function calloutAt(beat: BeatId, p: number) {
  if (beat === "paid") return receiptAt(p) * RECEIPT_FADE >= 0.5 ? 0 : 1;
  return 1;
}

/** The leader's ink drawing on: from 10% of its beat before the camera arrives on the part, to the arrival. */
function leaderInkAt(beat: BeatId, p: number) {
  if (!CHECK_IDS.includes(beat as CheckId)) return 0;
  const a = ARRIVE[beat];
  return smooth(inv(a - 0.1, a, local(beat, p)));
}

/** The leader's strength as the part closes: it fades (never retracts) over 6% of the beat as the camera leaves. */
function leaderFadeAt(beat: BeatId, p: number) {
  if (!CHECK_IDS.includes(beat as CheckId)) return 0;
  const d = DEPART[beat];
  return 1 - easeInOut(inv(d, d + 0.06, local(beat, p)));
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
  // The characters are read once the camera has arrived on the tag (code ARRIVE, 36%), M then 4 then T, and the read is
  // finished before the beat's hold (60%): at rest all three are underlined alike, none still being read.
  const chars = p < RANGES.code[0] ? 0 : p > RANGES.code[1] ? 3 : [0.4, 0.47, 0.54].filter((t) => codeT >= t).length;
  const charNow = p >= RANGES.code[0] && p <= RANGES.code[1] && codeT < 0.58 ? chars - 1 : -1;
  const paidT = local("paid", p);
  // The rule decides on the model's answer at once (the console's Decision and Photo check share a time).
  const ruled = p >= tickAt("torn");
  return {
    p,
    beat,
    cut: easeOut(inv(RANGES.intro[0] + 0.02, RANGES.intro[1] - 0.01, p)),
    live: opened("live", p),
    fp: fpOpen(p),
    code: opened("code", p),
    torn: opened("torn", p),
    // The halves part as the receipt lands and stay parted to the end: the last 3D frame before the console is the
    // pillow destroyed, never put back together. The turntable carries the motion after that.
    explode: smooth(inv(0.05, 0.45, paidT)) * (p >= RANGES.paid[0] ? 1 : 0),
    hash: smooth(inv(0.25, 0.6, local("fp", p))),
    chars,
    charNow,
    active,
    // The intro has a callout too (the photo being framed), so the side column is never empty while the pillow is cut.
    callout: calloutAt(beat, p),
    leader: leaderInkAt(beat, p) * leaderFadeAt(beat, p),
    leaderInk: leaderInkAt(beat, p),
    leaderFade: leaderFadeAt(beat, p),
    macro: macroAt(p),
    framed: p > RANGES.intro[1] ? 3 : FRAMED_AT.filter((t) => local("intro", p) >= t).length,
    done,
    seconds: elapsed(p),
    decision: ruled ? "pay" : elapsed(p) === null ? "waiting" : "checking",
    receipt: receiptAt(p),
    sent: p >= lerp(RANGES.paid[0], RANGES.paid[1], SENT_AT),
    stamped: p >= lerp(RANGES.paid[0], RANGES.paid[1], CONFIRMED_AT),
    shot: shotAt(p),
  };
}

/**
 * The p each beat is best seen at, for posters, the check buttons, the scroll stops and tests: a check just after it
 * has ticked (its bar full, the camera still on it), so every stop rests on a finished beat, never a bar part filled.
 */
export function holdOf(id: BeatId) {
  const [a, z] = RANGES[id];
  if (id === "intro") return z - 0.002;
  if (id === "paid") return lerp(a, z, 0.62);
  return tickAt(id) + 0.02 * (z - a);
}
