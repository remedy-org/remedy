import clsx from "clsx";
import Image from "next/image";
import { motion } from "motion/react";
import { CheckIcon, NoBreakHyphens } from "@/components/ui";

// What the laptop in the hero shows: claim RM-0442, the judges' genuine demo claim (DEMO_SAMPLES "genuine": photo c02,
// code M4T) on the Kikea X-VESOLJE recall, mid-check. Sizes are in em so the screen scales with the device.

// The five checks in the order Fraud checks lists them (Checks.tsx): three without AI, then the model's two.
export const CHECKS = ["Live camera session", "Photo not seen before", "Verified PayPal account", "Label and code M4T", "Cut fully in half"] as const;
/** phase: how many checks have passed; CHECKS.length + 1 means the payout has landed. */
export const FINAL_PHASE = CHECKS.length + 1;

const pop = { type: "spring", stiffness: 520, damping: 28 } as const;

function Corner({ className }: { className: string }) {
  return <span className={clsx("absolute size-[2.2em] border-text/70", className)} aria-hidden="true" />;
}

function CheckRow({ label, state }: { label: string; state: "waiting" | "running" | "pass" }) {
  return (
    <li className="flex items-center gap-[0.9em] border-b border-line py-[1.05em] last:border-b-0">
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
      <span className={clsx("text-[1.35em] leading-tight transition-colors duration-160", state === "waiting" ? "text-faint" : "text-text")}>{label}</span>
    </li>
  );
}

export function ClaimScreen({ phase }: { phase: number }) {
  return (
    <div className="flex h-full flex-col text-text">
      {/* Top bar: the product on the left, the recall's number (data, so mono) on the right. */}
      <div className="flex h-[3.4em] shrink-0 items-center gap-[1.4em] border-b border-line px-[1.6em]">
        <span className="text-[1.2em] text-text-2">
          <NoBreakHyphens>Kikea X-VESOLJE nursing pillow</NoBreakHyphens>
        </span>
        <span className="ml-auto font-mono text-[1.05em] text-faint">CPSC 27-071</span>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Camera */}
        <div className="flex min-w-0 flex-1 flex-col px-[1.6em] pt-[1.5em]">
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
            {/* The marked code region: a 1.5px box on the tag's code, labelled on it. In --text, not amber: the hero's CTA
                is the viewport's one amber. */}
            <span className="absolute top-[53%] left-[69%] h-[25%] w-[24.5%] rounded-[0.35em] border-[1.5px] border-text/70" aria-hidden="true">
              <span className="absolute bottom-full left-[-1.5px] mb-[0.4em] rounded-[0.4em] bg-bg/80 px-[0.7em] py-[0.3em] font-mono text-[1.1em] font-medium whitespace-nowrap text-text">
                M4T
              </span>
            </span>
          </div>
          <div className="flex flex-1 items-center justify-between">
            <span className="w-[8em] text-[1.15em] text-muted">Photo 1 of 3</span>
            <span className="flex size-[3.4em] items-center justify-center rounded-full border-2 border-text/80">
              <span className="size-[2.5em] rounded-full bg-text/90" />
            </span>
            <span className="w-[8em] text-right text-[1.15em] text-muted">Live camera</span>
          </div>
        </div>

        {/* Checks and result. */}
        <div className="flex w-[21.5em] shrink-0 flex-col border-l border-line px-[1.6em] pt-[1.3em] pb-[1.4em]">
          <ChecksPanel phase={phase} />
        </div>
      </div>
    </div>
  );
}

/** The checks ticking in, then the payout. Sized in em, so it scales with the device. */
export function ChecksPanel({ phase }: { phase: number }) {
  const passed = phase >= FINAL_PHASE;
  return (
    <>
      <span className="text-[1.15em] text-muted">Checks</span>
      <ol className="mt-[0.4em]">
        {CHECKS.map((label, i) => (
          <CheckRow key={label} label={label} state={phase > i ? "pass" : phase === i ? "running" : "waiting"} />
        ))}
      </ol>

      {/* The checks' own outcome, said once: the money is the receipt's, which leaves the screen from here (data-chip),
          and the time is the hero's facts'. */}
      <div className="relative mt-auto h-[3.8em] border-t border-line">
        <span
          data-seq="hide"
          className={clsx(
            // Out over 120ms before the outcome comes in (its delay below): the two messages never overprint.
            "absolute inset-0 flex items-center text-[1.25em] text-muted transition-opacity duration-[120ms]",
            passed && "opacity-0",
          )}
        >
          {phase < CHECKS.length ? `Checking ${phase + 1} of ${CHECKS.length}` : "Sending to PayPal"}
        </span>
        <motion.span
          data-seq="show"
          data-chip
          className="absolute inset-0 flex items-center text-[1.25em] font-medium whitespace-nowrap text-pay"
          initial={false}
          animate={passed ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
          transition={{ type: "spring", stiffness: 380, damping: 30, delay: passed ? 0.14 : 0 }}
        >
          All 5 checks passed
        </motion.span>
      </div>
    </>
  );
}
