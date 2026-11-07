import { Button, Card, ClockIcon } from "@/components/ui";
import type { DemoSample } from "@/lib/demo";
import type { CheckSpec } from "@/lib/types";
import { CodeTag } from "./CodeTag";
import { mmss, useCountdown } from "./useCountdown";

export interface CodeStepProps {
  code: string;
  spec: CheckSpec;
  expiresAt: string;
  startNow: number;
  frozen?: boolean;
  /** Demo: the sample whose photo is sent instead of the camera's. */
  sample?: DemoSample | null;
  onContinue(): void;
}

/** The one-time code, how to write it, and what the photos must show. The 10-minute session is already running. */
export function CodeStep({ code, spec, expiresAt, startNow, frozen, sample, onContinue }: CodeStepProps) {
  const demo = Boolean(sample);
  const left = useCountdown(expiresAt, startNow, frozen);
  const must = [
    ...spec.label_must_show.map((l) => `The label: ${l}`),
    ...spec.proof_steps,
    `The code ${code}, hand-written in marker`,
  ];
  return (
    <Card padding="lg" as="section" aria-labelledby="code-title" className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h2 id="code-title" className="text-h2 font-semibold text-balance">
          {demo ? `This sample's code is ${code}` : "Write this code on a paper tag"}
        </h2>
        <p className="text-body text-muted">
          {sample
            ? `A real claim gets a fresh code here, inside a 10-minute camera session. ${sample.tag}`
            : "Large and clear, in marker. It ties your photos to this claim, so a photo taken earlier, or for someone else, can't be used."}
        </p>
      </div>

      <div className="rounded-card border border-line bg-surface-2 px-4 py-6">
        <CodeTag code={code} />
      </div>

      <p className="flex items-center justify-between gap-3 rounded-control border border-line px-3 py-2.5 text-ui">
        <span className="flex items-center gap-2 text-muted">
          <ClockIcon />
          Camera session
        </span>
        <span className="font-mono tabular-nums text-text" role="timer" aria-live="off">
          {left > 0 ? `${mmss(left)} left` : "Ended"}
        </span>
      </p>

      <div className="flex flex-col gap-3">
        <h3 className="micro text-faint">Your photos must show</h3>
        <ol className="flex flex-col">
          {must.map((m, i) => (
            <li key={m} className="flex gap-3 border-b border-line py-2.5 text-ui last:border-b-0">
              <span className="w-4 shrink-0 font-mono text-faint tabular-nums">{i + 1}</span>
              <span className="text-text">{m}</span>
            </li>
          ))}
        </ol>
        {!demo && <p className="text-ui text-muted">One photo with all of it is fine, or up to three.</p>}
      </div>

      <Button size="lg" block onClick={onContinue} disabled={left <= 0}>
        {demo ? "Continue to the sample photo" : "I've written it. Open the camera"}
      </Button>
    </Card>
  );
}

