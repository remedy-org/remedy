import clsx from "clsx";
import type { ReactNode } from "react";
import { JudgesSheet } from "./JudgesSheet";

export type JudgeStep = "consent" | "samples" | "code" | "capture" | "checking" | "result";

// What each step of the demo proves, for judges. Real copy: every claim here is true of this build.
const NOTES: Record<JudgeStep, { title: string; note: string }> = {
  consent: {
    title: "Log in",
    // The card beside it says how to log in; this says what the login does.
    note: "The login is real PayPal OAuth, in the sandbox. The account's PayPal ID and verified status feed the checks, and the genuine sample's refund is paid to it.",
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
    note: "A real owner gets a fresh code, writes it on a tag and has 10 minutes to photograph it on this page's live camera: no file uploads. A sample's tag is already written, and the server sends its own copy of the photo.",
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

const REAL = ["The PayPal sandbox login", "The 3 checks with no AI, the photo check and the rule", "GPT-6.1 Sol reading the photo", "PayPal Payouts, in sandbox money"];
const STAGED = ["The photos: AI-made samples, not from a camera"];

function Notes({ step, note: own, children }: { step: JudgeStep; note?: string; children?: ReactNode }) {
  const { title, note: base } = NOTES[step];
  const note = own ?? base;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="micro text-faint">For judges · {title}</p>
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
  /** Replaces the step's note, e.g. one per outcome on a result. */
  note?: string;
  children: ReactNode;
  className?: string;
}

/**
 * The judges' notes beside a demo step: a rail on columns 10 to 12 of the page grid at 1200px and up; below, a "For
 * judges" pill in the header that opens a sheet. The step sits on columns 2 to 9, centred there, so the card and the
 * rail read as one composition rather than two islands.
 */
export function WithJudges({ demo, step, extra, note, children, className }: WithJudgesProps) {
  if (!demo) return <div className={className}>{children}</div>;
  return (
    <div className={clsx("grid gap-6 min-[1200px]:grid-cols-12 min-[1200px]:gap-x-(--col-gap)", className)}>
      {/* Below 1200px: a pill docked in the header (never over a step's button) that opens the notes as a sheet. */}
      <div className="contents min-[1200px]:hidden">
        <JudgesSheet>
          <Notes step={step} note={note}>
            {extra}
          </Notes>
        </JudgesSheet>
      </div>
      <div className="min-w-0 min-[1200px]:col-span-8 min-[1200px]:col-start-2">{children}</div>
      <aside aria-label="Notes for judges" className="hidden min-[1200px]:col-span-3 min-[1200px]:col-start-10 min-[1200px]:block">
        <div className="sticky top-8 border-l border-line pl-6">
          <Notes step={step} note={note}>
            {extra}
          </Notes>
        </div>
      </aside>
    </div>
  );
}
