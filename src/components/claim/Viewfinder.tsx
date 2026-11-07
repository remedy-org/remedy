import clsx from "clsx";
import type { ReactNode } from "react";

// The camera's chrome, shared by the live camera and the demo's sample: a dark frame in both themes, the cutout guide
// (Stripe Identity's), the reminder chips, the instruction bar under it and the dock. Presentational only.

/** Dark glass, 12px mono: chips that sit on the camera feed. */
export function GlassChip({ children, className, tone }: { children: ReactNode; className?: string; tone?: "accent" }) {
  return (
    <span
      className={clsx(
        "inline-flex h-7 items-center gap-1.5 rounded-control px-2.5 font-mono text-micro tracking-[0.06em] whitespace-nowrap uppercase tabular-nums backdrop-blur-sm",
        tone === "accent" ? "bg-accent text-accent-ink" : "bg-[oklch(0.12_0.01_255/0.72)] text-[oklch(0.96_0.005_255)]",
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

/** The reminders along the cutout's foot: what the photo needs. Reminders, never checks: the browser verifies nothing. */
export function Reminders({ items }: { items: string[] }) {
  return (
    <ul aria-label="Fit these in the frame" className="absolute inset-x-2 bottom-2 flex flex-wrap justify-center gap-1.5">
      {items.map((t) => (
        <li key={t}>
          <GlassChip>{t}</GlassChip>
        </li>
      ))}
    </ul>
  );
}

/** The 48px bar under the viewfinder that says what to do. */
export function InstructionBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("flex min-h-12 items-center justify-center border-t border-[oklch(1_0_0/0.08)] px-4 py-2 text-center", className)}>{children}</div>;
}

/** The dock: the shots on the left, the shutter in the middle, Send on the right. 152px tall on phones. */
export function Dock({ left, middle, right, short, className }: { left?: ReactNode; middle?: ReactNode; right?: ReactNode; short?: boolean; className?: string }) {
  return (
    <div className={clsx("grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 max-sm:pb-[env(safe-area-inset-bottom)] sm:px-5 sm:py-4", short ? "max-sm:py-5" : "max-sm:h-[152px]", className)}>
      <div className="flex min-w-0 items-center gap-2">{left}</div>
      <div className="flex flex-col items-center gap-2">{middle}</div>
      <div className="flex min-w-0 items-center justify-end">{right}</div>
    </div>
  );
}
