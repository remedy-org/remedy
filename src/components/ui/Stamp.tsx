import clsx from "clsx";
import type { CSSProperties, ReactNode } from "react";

export type StampTone = "pay" | "hold" | "stop" | "neutral";

export interface StampProps {
  /** One or two words, uppercase: PAID, HELD FOR REVIEW, RECEIVED. */
  children: ReactNode;
  tone?: StampTone;
  /** Degrees; -8 by default. The tilt is fixed, never animated. */
  rotate?: number;
  /** Land on mount (scale 1.4 to 1 and fade in, 200ms); a number delays it in ms. Static under reduced motion. */
  land?: boolean | number;
  className?: string;
}

const tones: Record<StampTone, string> = {
  // Ink at 85%, as a colour rather than opacity, so the landing fade can end at 1.
  pay: "text-pay-ink/85",
  hold: "text-hold-ink/85",
  stop: "text-stop-ink/85",
  neutral: "text-ink-muted/85",
};

/**
 * A rubber stamp in one ink on paper: 2px border, 14px mono, ink at 85%. Decorative (aria-hidden): the status it
 * shows is always also written out in text. Never larger, never textured.
 */
export function Stamp({ children, tone = "neutral", rotate = -8, land, className }: StampProps) {
  const style: CSSProperties & Record<"--stamp-delay", string> = {
    rotate: `${rotate}deg`,
    "--stamp-delay": typeof land === "number" ? `${land}ms` : "0ms",
  };
  return (
    <span
      aria-hidden="true"
      style={style}
      className={clsx(
        // The right padding gives back the tracking after the last letter, so the word sits centred in its border.
        "inline-flex h-8 items-center rounded-control border-2 border-current pr-[calc(0.625rem-0.14em)] pl-2.5 font-mono text-ui leading-none font-semibold tracking-[0.14em] whitespace-nowrap uppercase select-none",
        tones[tone],
        land !== undefined && land !== false && "stamp-land",
        className,
      )}
    >
      {children}
    </span>
  );
}
