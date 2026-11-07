import clsx from "clsx";
import type { ReactNode } from "react";
import { JudgesSheet } from "./JudgesSheet";

export type JudgeStep = "consent" | "samples" | "code" | "capture" | "checking" | "result";

// What each step of the demo proves, for judges. Real copy: every claim here is true of this build.
const NOTES: Record<JudgeStep, { title: string; note: string }> = {
  consent: {
    title: "Log in",
    note: "Log in with a PayPal sandbox personal account: the test login is in the submission notes. Your real PayPal login won't work here.",
  },
  samples: {
    title: "Pick a sample",
    note: "Run them in order. Only the genuine claim should be paid, and only once per round. Each sample is a real claim through the real checks.",
  },
  code: {
    title: "The code",
    note: "A real owner gets a fresh code here and has 10 minutes to photograph it. This sample's tag already shows its code.",
  },
  capture: {
    title: "The photo",
    note: "A real owner can't upload a file: photos only come from this page's live camera. Samples are sent by the server from its own copy.",
  },
  checking: {
    title: "The checks",
    note: "Three checks run before any AI. The model (GPT-6.1 Sol) only describes the photo; a fixed rule in code decides.",
  },
  result: {
    title: "The result",
    note: "The rule's decision, with the evidence it used. Paid claims go out through PayPal Payouts in sandbox money.",
  },
};

const REAL = ["The PayPal sandbox login", "The five checks and the rule", "GPT-6.1 Sol reading the photo", "PayPal Payouts, in sandbox money"];
const STAGED = ["The photos: AI-made samples, not from a camera"];

function Notes({ step, children }: { step: JudgeStep; children?: ReactNode }) {
  const { title, note } = NOTES[step];
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="micro text-accent-text">For judges · {title}</p>
        <p className="text-ui text-muted">{note}</p>
      </div>
      {children}
      <dl className="flex flex-col gap-3 border-t border-line pt-4 text-ui">
        <div className="flex flex-col gap-1.5">
          <dt className="micro text-faint">Real</dt>
          {REAL.map((r) => (
            <dd key={r} className="text-text">
              {r}
            </dd>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          <dt className="micro text-faint">Staged</dt>
          {STAGED.map((r) => (
            <dd key={r} className="text-text">
              {r}
            </dd>
          ))}
        </div>
      </dl>
    </div>
  );
}

export interface WithJudgesProps {
  /** Only the judges' demo has the rail; otherwise the children render alone. */
  demo: boolean;
  step: JudgeStep;
  /** Step-specific extras for the rail: the scoreboard, the expected outcome, the next sample. */
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * The judges' notes beside a demo step: a 280px rail at 1200px and up, a "For judges" pill that opens a sheet below.
 * The step itself sits centred in the space left of the rail.
 */
export function WithJudges({ demo, step, extra, children, className }: WithJudgesProps) {
  if (!demo) return <div className={className}>{children}</div>;
  return (
    <div className={clsx("grid gap-6 min-[1200px]:grid-cols-[minmax(0,1fr)_280px] min-[1200px]:gap-12", className)}>
      {/* Floats bottom right; it steps up over the consent screen's sticky action bar when that shows. */}
      <div className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 transition-[bottom] duration-160 ease-snap min-[1200px]:hidden [body:has([data-cta-shown])_&]:bottom-24">
        <JudgesSheet>
          <Notes step={step}>{extra}</Notes>
        </JudgesSheet>
      </div>
      <div className="min-w-0">{children}</div>
      <aside aria-label="Notes for judges" className="hidden min-[1200px]:block">
        <div className="sticky top-8 border-l border-line pl-6">
          <Notes step={step}>{extra}</Notes>
        </div>
      </aside>
    </div>
  );
}
