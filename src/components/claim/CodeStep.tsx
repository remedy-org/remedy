import clsx from "clsx";
import { useSyncExternalStore } from "react";
import { AlertIcon, Button, Card, ClockIcon, NoBreakHyphens } from "@/components/ui";
import type { CheckSpec } from "@/lib/types";
import { CodeTag } from "./CodeTag";
import { StepTitle } from "./Exhibit";
import styles from "./flow.module.css";
import { MobileCta } from "./MobileCta";
import { cutInHalf, handWrittenLabel, ownerLabel, photosTakenKey, taggedThing } from "./model";
import { PhoneHandoff } from "./PhoneHandoff";
import { mmss, useCountdown } from "./useCountdown";

const OPEN = "I've written it. Open the camera";
const LOW = "Under a minute left: open the camera now. If it runs out, you can get a new code.";

// The camera session's length: the countdown's line depletes over it.
const SESSION_MS = 10 * 60_000;

export interface CodeStepProps {
  claimId: string;
  code: string;
  spec: CheckSpec;
  expiresAt: string;
  startNow: number;
  frozen?: boolean;
  /** Real claims on a laptop: the QR code that carries this claim to a phone. */
  qrSvg?: string;
  phoneUrl?: string;
  /** Once the code has run out: a fresh claim and code. */
  newClaimHref: string;
  onContinue(): void;
}

const noop = () => () => {};
// sessionStorage can throw (private windows, blocked site data): then there's nothing to say.
const readTaken = (claimId: string) => {
  try {
    return sessionStorage.getItem(photosTakenKey(claimId)) !== null;
  } catch {
    return false;
  }
};

/** The countdown, in mono beside the title: bright under a minute, "Ended" at zero. */
export function TimerPill({ left, className }: { left: number; className?: string }) {
  const low = left > 0 && left < 60_000;
  return (
    <span className={clsx("inline-flex shrink-0 items-center gap-1.5 font-mono text-ui", low ? "font-medium text-text" : "text-muted", className)}>
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
export function CodeStep({ claimId, code, spec, expiresAt, startNow, frozen, qrSvg, phoneUrl, newClaimHref, onContinue }: CodeStepProps) {
  const left = useCountdown(expiresAt, startNow, frozen);
  const ended = left <= 0;
  const low = !ended && left < 60_000;
  // This tab had taken photos it never sent, then reloaded (or the phone reclaimed the tab): they're gone, so say so.
  const lost = useSyncExternalStore(noop, () => readTaken(claimId), () => false) && !ended;
  // A recall whose label is itself hand-written on the tag gets one tag with both on it.
  const written = handWrittenLabel(spec);
  const cut = cutInHalf(spec);
  const thing = taggedThing(spec)?.replace(/^(cut|destroyed) /, "") ?? "product";
  const handoff = qrSvg && phoneUrl;
  // The shot list, said once.
  const shots = (
    <p className="text-body text-pretty text-text lg:[grid-area:list]">
      {written ? (
        <>
          Photograph the tag with <NoBreakHyphens>{written}</NoBreakHyphens> and <span className="font-mono whitespace-nowrap">{code}</span>, and the {thing} {cut ? "cut in half" : "destroyed"}.
        </>
      ) : (
        <>
          Photograph the code <span className="font-mono whitespace-nowrap">{code}</span> beside the label{spec.label_must_show[0] ? ` (${ownerLabel(spec.label_must_show[0])})` : ""}, and the product {cut ? "cut in half" : "destroyed"}.
        </>
      )}{" "}
      <span className="text-muted">One photo is enough; you can take up to three.</span>
    </p>
  );
  return (
    // From 1024px two columns, so the action is on the first screen: the tag and the shot list on the left, the phone's
    // QR (or the button) on the right. On a phone the button follows the tag and the shot list comes after it.
    <>
      <Card
        padding="lg"
        as="section"
        aria-labelledby="code-title"
        className="relative flex flex-col gap-8 overflow-hidden [@media(max-height:600px)]:gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-x-10 lg:[grid-template-areas:'head_head'_'tag_act'_'list_act']"
      >
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-line">
          <span className={clsx("block h-full bg-text/70", styles.deplete)} style={{ transform: `scaleX(${Math.min(1, left / SESSION_MS)})` }} />
        </span>

        <div className="flex items-start justify-between gap-4 lg:[grid-area:head]">
          <StepTitle id="code-title">Write this code on a paper tag</StepTitle>
          <TimerPill left={left} className="mt-2" />
        </div>

        <div className="flex flex-col gap-6 pt-6 lg:[grid-area:tag] [@media(max-height:600px)]:pt-2">
          <CodeTag
            code={code}
            written={written}
            label={written ? "Write this on your tag" : "Your code"}
            string
            foot={`Write it big, about 1\u00a0inch (3\u00a0cm), in marker.${low || ended ? "" : " Valid for 10 minutes."}`}
          />
          <p className="text-ui text-muted">It ties your photos to this claim.</p>
        </div>

        <div className="flex flex-col gap-4 lg:[grid-area:act] lg:self-start">
          {lost && (
            <p role="status" className="flex gap-2.5 rounded-control bg-surface-2 px-3 py-2.5 text-ui text-text shadow-[inset_0_0_0_1px_var(--line-2)]">
              <AlertIcon className="mt-0.5 shrink-0 text-muted" />
              <span>Your camera was closed. Photos are only kept until you send them: open the camera to take them again.</span>
            </p>
          )}
          {low && (
            <p role="status" className="flex gap-2.5 text-ui font-medium text-text">
              <ClockIcon className="mt-0.5 shrink-0" />
              <span>{LOW}</span>
            </p>
          )}
          {ended ? (
            <>
              <p className="text-ui text-muted">This code has run out. Codes last 10 minutes.</p>
              <Button id="code-cta" href={newClaimHref} size="lg" block prefetch={false}>
                Get a new code
              </Button>
            </>
          ) : handoff ? (
            <>
              {/* A laptop (a fine pointer, 640px and up): the phone leads. A phone or tablet: its own camera, the primary action. */}
              <div className="hidden flex-col gap-4 sm:pointer-fine:flex">
                <PhoneHandoff qrSvg={qrSvg} url={phoneUrl} code={code} primary />
                <Button size="lg" block variant="secondary" onClick={onContinue}>
                  Open this laptop&apos;s camera
                </Button>
              </div>
              <div className="flex flex-col sm:pointer-fine:hidden">
                <Button id="code-cta" size="lg" block onClick={onContinue}>
                  {OPEN}
                </Button>
              </div>
            </>
          ) : (
            <Button id="code-cta" size="lg" block onClick={onContinue}>
              {OPEN}
            </Button>
          )}
        </div>

        {shots}
      </Card>
      {/* Phones: while the button is below the fold (or under Safari's toolbar), the same action waits pinned at the bottom. */}
      {ended ? <MobileCta target="code-cta" href={newClaimHref} label="Get a new code" /> : <MobileCta target="code-cta" onClick={onContinue} label={OPEN} note={low ? LOW : undefined} />}
    </>
  );
}
