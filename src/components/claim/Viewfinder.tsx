import clsx from "clsx";
import type { ReactNode } from "react";
import { EvidenceText } from "./EvidenceText";

// The camera's chrome, shared by the live camera and the demo's photo: a dark frame in both themes, the cutout guide
// (Stripe Identity's), the instruction bar under it and the dock. Presentational only.

/** Dark glass, 12px mono: the data chips that sit on the camera feed (the photo number, the timer). */
export function GlassChip({ children, className, tone }: { children: ReactNode; className?: string; tone?: "accent" }) {
  return (
    <span
      className={clsx(
        "inline-flex h-7 items-center gap-1.5 rounded-control px-2.5 font-mono text-micro tracking-normal whitespace-nowrap tabular-nums backdrop-blur-sm",
        tone === "accent" ? "bg-accent text-accent-ink" : "bg-[oklch(0.12_0.004_75/0.72)] text-[oklch(0.96_0.006_85)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Where the product goes: an inset rectangle (8% from the sides, 12% from top and bottom), 2px white at 85%, with the
 * feed outside it dimmed. `dashed` is the same frame holding a message instead of a picture.
 */
export function Cutout({ children, dashed, className }: { children?: ReactNode; dashed?: boolean; className?: string }) {
  return (
    <div
      className={clsx(
        "absolute inset-x-[8%] inset-y-[12%] rounded-frame",
        dashed ? "border-2 border-dashed border-[oklch(1_0_0/0.4)]" : "border-2 border-[oklch(1_0_0/0.85)] shadow-[0_0_0_100vmax_oklch(0_0_0/0.45)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** What the photo needs, in one line in the instruction bar: under the frame, never over the tag it points at. */
export function Reminder({ text, id }: { text: string; id?: string }) {
  if (!text) return null;
  return (
    <p id={id} className="text-ui text-balance text-[oklch(0.86_0.005_80)]">
      <EvidenceText>{text}</EvidenceText>
    </p>
  );
}

/** The 48px bar under the viewfinder that says what to do. */
export function InstructionBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("flex min-h-12 items-center justify-center border-t border-[oklch(1_0_0/0.08)] px-4 py-2 text-center", className)}>{children}</div>;
}

/**
 * The dock: the shots on the left, the shutter in the middle, Send on the right. On phones it is 152px tall in two rows,
 * the three 48px shots over the shutter and Send, since three 48px slots don't fit beside a 72px shutter at 375px.
 */
export function Dock({ left, middle, right, short, className }: { left?: ReactNode; middle?: ReactNode; right?: ReactNode; short?: boolean; className?: string }) {
  return (
    <div
      className={clsx(
        "grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 sm:px-5 sm:py-4",
        // The short dock's 20px foot also clears the home indicator (a lone pb would override py and drop it to 0).
        short
          ? "max-sm:pt-5 max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]"
          : "max-sm:h-[152px] max-sm:grid-rows-[3rem_4.5rem] max-sm:content-center max-sm:gap-y-2.5 max-sm:pb-[env(safe-area-inset-bottom)]",
        className,
      )}
    >
      <div className={clsx("flex min-w-0 items-center gap-2", !short && "max-sm:col-span-3 max-sm:justify-center")}>{left}</div>
      <div className={clsx("flex flex-col items-center gap-2", !short && "max-sm:col-start-2 max-sm:row-start-2")}>{middle}</div>
      <div className={clsx("flex min-w-0 items-center justify-end", !short && "max-sm:col-start-3 max-sm:row-start-2")}>{right}</div>
    </div>
  );
}

/**
 * Phones: the camera fills the screen under the 64px header as a grid (viewfinder, instruction bar, dock), like a
 * camera app. From 640px it is a 4:3 card. FlowShell drops its footer and bottom padding while [data-camera] is on screen.
 */
export const CAMERA_FRAME =
  "overflow-hidden bg-[oklch(0.12_0.004_75)] text-text max-sm:mx-[calc(var(--gutter)*-1)] max-sm:-mt-8 max-sm:grid max-sm:h-[calc(100dvh-4rem-1px)] max-sm:grid-rows-[minmax(0,1fr)_auto_auto] max-sm:[@media(max-height:600px)]:-mt-4 max-sm:[@media(max-height:600px)]:h-[calc(100dvh-3rem-1px)] sm:rounded-card sm:shadow-ring";
export const CAMERA_VIEW = "relative overflow-hidden max-sm:min-h-0 sm:aspect-[4/3]";
