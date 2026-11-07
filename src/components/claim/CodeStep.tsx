import clsx from "clsx";
import { Button, Card, ClockIcon, NoBreakHyphens } from "@/components/ui";
import type { CheckSpec } from "@/lib/types";
import { CodeTag } from "./CodeTag";
import { StepTitle } from "./Exhibit";
import styles from "./flow.module.css";
import { acceptsStandIn, cutInHalf, handWrittenLabel, ownerLabel } from "./model";
import { PhoneHandoff } from "./PhoneHandoff";
import { mmss, useCountdown } from "./useCountdown";

// The camera session's length: the countdown's line depletes over it.
const SESSION_MS = 10 * 60_000;

export interface CodeStepProps {
  code: string;
  spec: CheckSpec;
  expiresAt: string;
  startNow: number;
  frozen?: boolean;
  /** Real claims on a laptop: the QR code that carries this claim to a phone. */
  qrSvg?: string;
  phoneUrl?: string;
  onContinue(): void;
}

/** The countdown as a quiet pill (Wise's quote timer): amber under a minute, "Ended" at zero. */
export function TimerPill({ left, className }: { left: number; className?: string }) {
  const low = left > 0 && left < 60_000;
  return (
    <span className={clsx("inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 font-mono text-ui tabular-nums", low ? "border-accent/50 text-accent-text" : "border-line text-muted", className)}>
      <ClockIcon size={14} />
      <span role="timer" aria-live="off" aria-label={left > 0 ? `${mmss(left)} left on the camera session` : "The camera session has ended"} className={clsx(left > 0 && left < 10_000 && styles.urgent)}>
        {left > 0 ? mmss(left) : "Ended"}
      </span>
    </span>
  );
}

/**
 * The one-time code, as the paper tag it should end up on. A 2px line along the card's top edge runs down with the
 * 10-minute session. On a laptop the phone is the recommended camera: its QR leads, and the laptop's camera is second.
 */
export function CodeStep({ code, spec, expiresAt, startNow, frozen, qrSvg, phoneUrl, onContinue }: CodeStepProps) {
  const left = useCountdown(expiresAt, startNow, frozen);
  // A recall whose label is itself hand-written on the tag (the demo's stand-in) gets one tag with both on it.
  const written = handWrittenLabel(spec);
  const destroyed = cutInHalf(spec) ? "cut" : "destroyed";
  const must = [...spec.label_must_show.map((l) => `The label: ${ownerLabel(l)}`), ...spec.proof_steps, written ? `The code ${code}, on the same tag` : `The code ${code}, hand-written in marker`];
  const handoff = qrSvg && phoneUrl;
  // The whole job in one sentence, above the button: the list below is the detail.
  const instruction = (
    <p className="text-body text-pretty text-text">
      {written ? (
        <>
          On one paper tag, write <NoBreakHyphens>{written}</NoBreakHyphens> and <span className="font-mono whitespace-nowrap">{code}</span>. Tie it to the {destroyed} product and get all of it in one photo.
        </>
      ) : (
        <>
          Write <span className="font-mono whitespace-nowrap">{code}</span> on a paper tag and lay it on the {destroyed} product, next to its label, so all of it is in one photo.
        </>
      )}
    </p>
  );
  const list = (
    <div className="flex flex-col gap-3 lg:[grid-area:list]">
      <h3 className="micro text-faint">Your photo must show</h3>
      <ol className="flex flex-col">
        {must.map((m, i) => (
          <li key={m} className="grid grid-cols-[2rem_minmax(0,1fr)] items-baseline border-b border-line py-2.5 text-ui last:border-b-0">
            <span className="font-mono text-micro text-faint tabular-nums">{String(i + 1).padStart(2, "0")}</span>
            <span className="text-text">{m}</span>
          </li>
        ))}
      </ol>
      <p className="text-ui text-muted">One photo with all of it is fine, or up to three.</p>
      {acceptsStandIn(spec) && <p className="text-ui text-muted">This is a demo recall: the real product has no label, so a stand-in with the hand-written {written ?? "label"} tag counts.</p>}
    </div>
  );
  return (
    // From 1024px two columns, so the action is on the first screen: the tag and the shot list on the left, the phone's
    // QR (or the button) on the right. On a phone the button follows the tag and the shot list comes after it.
    <Card
      padding="lg"
      as="section"
      aria-labelledby="code-title"
      className="relative flex flex-col gap-8 overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-x-10 lg:[grid-template-areas:'head_head'_'tag_act'_'list_act']"
    >
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-line">
        <span className={clsx("block h-full", styles.deplete, left < 60_000 ? "bg-accent" : "bg-text/70")} style={{ transform: `scaleX(${Math.min(1, left / SESSION_MS)})` }} />
      </span>

      <div className="flex flex-col gap-3 lg:[grid-area:head]">
        <div className="flex items-start justify-between gap-4">
          <StepTitle id="code-title">Write this code on a paper tag</StepTitle>
          <TimerPill left={left} className="mt-1" />
        </div>
        {/* Phones: the instruction above the button says it, and the tag's foot says how big, so the button stays on the first screen. */}
        <p className="max-w-[60ch] text-body text-muted max-sm:hidden">
          Write it big: letters at least 3 cm tall, in marker. It ties your photos to this claim, so a photo taken earlier, or for someone else, can&apos;t be used.
        </p>
      </div>

      <div className="pt-6 pb-2 lg:[grid-area:tag]">
        <CodeTag code={code} string foot="Write it big, 3 cm tall, in marker. Valid for 10 minutes." />
      </div>

      <div className="flex flex-col gap-4 lg:[grid-area:act] lg:self-start">
        {instruction}
        {handoff ? (
          <>
            {/* A laptop (a fine pointer, 640px and up): the phone leads. A phone or tablet: its own camera, the primary action. */}
            <div className="hidden flex-col gap-4 sm:pointer-fine:flex">
              <PhoneHandoff qrSvg={qrSvg} url={phoneUrl} code={code} primary />
              <Button size="lg" block variant="secondary" onClick={onContinue} disabled={left <= 0}>
                Open this laptop&apos;s camera
              </Button>
            </div>
            <div className="flex flex-col sm:pointer-fine:hidden">
              <Button size="lg" block onClick={onContinue} disabled={left <= 0}>
                I&apos;ve written it. Open the camera
              </Button>
            </div>
          </>
        ) : (
          <Button size="lg" block onClick={onContinue} disabled={left <= 0}>
            I&apos;ve written it. Open the camera
          </Button>
        )}
      </div>

      {list}
    </Card>
  );
}
