// The motion tokens from DESIGN.md for Motion (motion/react), mirroring the --ease-* and --dur-* CSS variables in
// globals.css. Durations are in seconds, as Motion takes them.

export const EASE = {
  /** UI state changes, 160ms. */
  snap: [0.2, 0.8, 0.2, 1],
  /** Reveals (700 to 1000ms) and panels (160ms). */
  outExpo: [0.16, 1, 0.3, 1],
  /** Objects moving, 500 to 800ms; leader lines and strings drawing. */
  outQuart: [0.165, 0.84, 0.44, 1],
  /** Flips triggered at a threshold, 600 to 700ms. */
  inOutQuart: [0.76, 0, 0.24, 1],
  /** Stamps landing, 200ms. */
  back: [0.34, 1.56, 0.64, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

export const DURATION = {
  ui: 0.16,
  move: 0.36,
  object: 0.56,
  reveal: 0.9,
} as const;

export const SPRING = {
  /** Paper tags and thumbnails settling onto a surface. */
  drop: { type: "spring", stiffness: 320, damping: 26 },
} as const;
