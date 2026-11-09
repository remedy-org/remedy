import clsx from "clsx";
import type { CSSProperties } from "react";
import sample from "./analyst-sample.json";
import { TOUR } from "./tour-copy";
import styles from "./tour.module.css";

// The recall analyst's answer on the homepage: a recording, never live. Mohit asks "Why were 9 claims refused?" once in
// /console/insights on a workspace holding only the seven demo claims and pastes the answer into analyst-sample.json;
// analyst-sample.test.ts checks every number and claim id in it against the seed. With no recording the rail isn't
// drawn at all, and the Insights step's canvas takes the full width.

export interface AnalystRecording {
  question: string;
  answer: string;
  /** The analyst's tool calls, as the console's rail shows them ("explain_claim · RM-9545"). */
  tools: { name: string; id?: string }[];
  model: string;
  /** When it was recorded, e.g. "8 Nov 2026". */
  date: string;
}

export const RECORDING = (sample as { recorded: AnalystRecording | null }).recorded;

export function AnalystRail({ recording = RECORDING, form = "frame" }: { recording?: AnalystRecording | null; form?: "frame" | "phone" }) {
  if (!recording) return null;
  const lines = recording.answer.split(/\n+/).filter(Boolean);
  return (
    <div className={clsx("flex flex-col gap-3 rounded-card bg-surface p-4 shadow-card", form === "frame" && "h-full overflow-hidden")}>
      <p className="flex items-baseline justify-between gap-3">
        <span className="text-ui font-medium">{TOUR.analyst.title}</span>
        <span className="text-micro text-faint">{TOUR.analyst.limit}</span>
      </p>
      <p className="ml-6 self-end rounded-card bg-surface-2 px-3 py-2 text-ui">{recording.question}</p>
      <div className="flex flex-col gap-2 text-ui text-text-2" data-answer>
        {lines.map((line, i) => (
          <p key={i} className={styles.answerLine} style={{ "--line": i } as CSSProperties}>
            {line}
          </p>
        ))}
      </div>
      {recording.tools.length > 0 && (
        <p className="font-mono text-micro text-faint">{recording.tools.map((t) => (t.id ? `${t.name} · ${t.id}` : t.name)).join(", ")}</p>
      )}
      <p className="mt-auto font-mono text-micro text-faint">
        {TOUR.analyst.recorded} · {recording.model} · {recording.date}
      </p>
    </div>
  );
}
