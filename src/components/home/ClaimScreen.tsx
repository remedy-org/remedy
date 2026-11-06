import clsx from "clsx";
import Image from "next/image";
import { motion } from "motion/react";
import { CheckIcon } from "@/components/ui";
import styles from "./device.module.css";

// What the laptop in the hero shows: the judges' genuine demo claim (DEMO_SAMPLES "genuine": photo c02, code M4T)
// on the Kikea X-VESOLJE recall, mid-check. Sizes are in em so the screen scales with the device.

// The five checks in the order "What stops a fake" lists them (Checks.tsx): three without AI, then the model's two.
export const CHECKS = ["Live camera session", "Photo not seen before", "Verified PayPal account", "Label and code M4T", "Cut fully in half"] as const;
/** phase: how many checks have passed; CHECKS.length + 1 means the payout has landed. */
export const FINAL_PHASE = CHECKS.length + 1;

// Where each exhibit points, as a share of the 4:3 camera frame. The photo is 2:3 portrait, cropped to 4:3 at
// object-position 50% 75%, so the frame shows image heights 37.5%-87.5%.
export const ANCHORS = {
  label: { x: 0.8, y: 0.6 },
  cut: { x: 0.29, y: 0.5 },
  code: { x: 0.74, y: 0.77 },
} as const;
export type AnchorId = keyof typeof ANCHORS;

const pop = { type: "spring", stiffness: 520, damping: 28 } as const;

function Corner({ className }: { className: string }) {
  return <span className={clsx("absolute size-[2.2em] border-text/70", className)} aria-hidden="true" />;
}

function CheckRow({ label, state }: { label: string; state: "waiting" | "running" | "pass" }) {
  return (
    <li className="flex items-center gap-[0.9em] border-b border-line py-[0.95em] last:border-b-0">
      <span className="relative flex size-[1.9em] shrink-0 items-center justify-center">
        <span
          className={clsx(
            "absolute inset-0 rounded-full border transition-colors duration-160",
            state === "running" ? "border-text/70" : "border-line-strong",
          )}
        />
        <motion.span
          data-seq="show"
          className="absolute inset-0 flex items-center justify-center rounded-full bg-pay-soft text-pay"
          initial={false}
          animate={state === "pass" ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.4 }}
          transition={pop}
        >
          <CheckIcon size={16} className="size-[1.25em]" />
        </motion.span>
      </span>
      <span className={clsx("text-[1.2em] leading-tight transition-colors duration-160", state === "waiting" ? "text-faint" : "text-text")}>{label}</span>
    </li>
  );
}

export function ClaimScreen({ phase }: { phase: number }) {
  return (
    <div className="flex h-full flex-col text-text">
      {/* Top bar, left-aligned so the exhibit leaders drop through the empty middle of the bar, not through text. */}
      <div className="flex h-[3.4em] shrink-0 items-center gap-[1.4em] border-b border-line px-[1.6em]">
        <span className="flex items-center gap-[0.6em] font-mono text-[1.05em] tracking-[0.06em] text-pay uppercase">
          <span className="size-[0.6em] rounded-full bg-pay" />
          Live
        </span>
        <span className="text-[1.15em] text-muted">Kikea X-VESOLJE nursing pillow</span>
        <span className="ml-auto font-mono text-[1.05em] tracking-[0.06em] text-faint uppercase">CPSC 27-071</span>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Camera */}
        <div className={clsx("flex min-w-0 flex-1 flex-col px-[1.6em] pt-[1.5em]", styles.cameraCol)}>
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[0.5em] bg-surface-2">
            <Image
              src="/demo/c02-1.jpg"
              alt=""
              fill
              preload
              sizes="(max-width: 640px) 60vw, 420px"
              className="object-cover"
              style={{ objectPosition: "50% 75%" }}
            />
            <Corner className="left-[1em] top-[1em] border-l border-t" />
            <Corner className="right-[1em] top-[1em] border-r border-t" />
            <Corner className="bottom-[1em] left-[1em] border-b border-l" />
            <Corner className="bottom-[1em] right-[1em] border-b border-r" />
            <span className="absolute left-[1.4em] top-[1.4em] rounded-[0.4em] bg-bg/80 px-[0.7em] py-[0.35em] font-mono text-[1.05em] tracking-[0.06em] text-text uppercase">
              Code M4T
            </span>
            {(Object.keys(ANCHORS) as AnchorId[]).map((id) => (
              <span
                key={id}
                data-anchor={id}
                className="absolute size-px"
                style={{ left: `${ANCHORS[id].x * 100}%`, top: `${ANCHORS[id].y * 100}%` }}
              />
            ))}
          </div>
          <div className="flex flex-1 items-center justify-between">
            <span className="font-mono text-[1.05em] tracking-[0.06em] text-faint uppercase">Photo 1 of 3</span>
            <span className="flex size-[3.4em] items-center justify-center rounded-full border-2 border-text/80">
              <span className="size-[2.5em] rounded-full bg-text/90" />
            </span>
            <span className="font-mono text-[1.05em] tracking-[0.06em] text-faint uppercase">No uploads</span>
          </div>
        </div>

        {/* Checks and result. On a narrow stage they leave the screen for the full-size card under the laptop. */}
        <div className={clsx("flex w-[21.5em] shrink-0 flex-col border-l border-line px-[1.6em] pt-[1.3em] pb-[1.4em]", styles.wideOnly)}>
          <ChecksPanel phase={phase} />
        </div>
      </div>
    </div>
  );
}

/** The checks ticking in, then the payout. Sized in em: inside the lid it scales with the device; under it, 1.2em = 14px. */
export function ChecksPanel({ phase }: { phase: number }) {
  const paid = phase >= FINAL_PHASE;
  return (
    <>
      <span className="font-mono text-[1.05em] tracking-[0.06em] text-faint uppercase">Checks</span>
      <ol className="mt-[0.4em]">
        {CHECKS.map((label, i) => (
          <CheckRow key={label} label={label} state={phase > i ? "pass" : phase === i ? "running" : "waiting"} />
        ))}
      </ol>

      <span className="mt-auto pt-[1em] font-mono text-[1.05em] tracking-[0.06em] text-faint uppercase">Result</span>
      <div className="relative mt-[0.7em] h-[3.6em]">
        <span
          data-seq="hide"
          className={clsx(
            "absolute inset-0 flex items-center rounded-[0.5em] border border-dashed border-line-strong px-[1em] text-[1.15em] text-faint transition-opacity duration-160",
            paid && "opacity-0",
          )}
        >
          {phase < CHECKS.length ? `Checking ${phase + 1} of ${CHECKS.length}` : "Sending refund"}
        </span>
        <motion.span
          data-seq="show"
          className="absolute inset-0 flex items-center gap-[0.5em] rounded-[0.5em] border border-pay/50 bg-pay-soft px-[1em] text-[1.2em] whitespace-nowrap text-pay"
          initial={false}
          animate={paid ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 8, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        >
          <span className="font-mono font-semibold">$29.99</span>
          <span>sent to PayPal · 41 s</span>
        </motion.span>
      </div>
      <span className="mt-[0.9em] text-[1.05em] text-faint">PayPal Payouts · verified account</span>
    </>
  );
}
