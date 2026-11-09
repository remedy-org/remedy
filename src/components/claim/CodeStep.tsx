import clsx from "clsx";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui";
import type { CheckSpec } from "@/lib/types";
import { CodeTag } from "./CodeTag";
import { STEP_GRID, StepTitle } from "./Exhibit";
import styles from "./flow.module.css";
import { MobileCta } from "./MobileCta";
import { Notice } from "./Notice";
import { cutInHalf, handWrittenLabel, ownerLabel, photosTakenKey, taggedThing } from "./model";
import { PhoneHandoff } from "./PhoneHandoff";
import { mmss, useCountdown } from "./useCountdown";

// One name for the one action, in the step and in the phone's pinned bar.
const OPEN = "Open the camera";
const LOW = "Under a minute left: open the camera now.";

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

/** The countdown beside the title, said as words with the digits in mono ("9:57 left"): red under a minute, "Ended" at zero. */
export function TimerPill({ left, className }: { left: number; className?: string }) {
  const low = left > 0 && left < 60_000;
  return (
    <span className={clsx("inline-flex shrink-0 items-center whitespace-nowrap text-ui", low ? "font-medium text-stop" : "text-muted", className)}>
      <span role="timer" aria-live="off" aria-label={left > 0 ? `${mmss(left)} left to take the photo` : "The camera session has ended"} className={clsx(left > 0 && left < 10_000 && styles.urgent)}>
        {left > 0 ? (
          <>
            <span className="font-mono">{mmss(left)}</span> left
          </>
        ) : (
          "Ended"
        )}
      </span>
    </span>
  );
}

/**
 * The one-time code, as the paper tag it should end up on, on the step grid: the tag on the left, the title, the shot list
 * and the way to the camera on the right. On a laptop the phone is the camera to use (a cut pillow on the floor is
 * photographed with a phone), so its QR leads and this computer's camera is the quiet button after it. At zero the
 * step turns into its expired state: the tag struck through, the reason, and a new code.
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
  // A touch phone's pinned bar carries "Under a minute left" while it is up; the step says it whenever the bar isn't.
  const [barShown, setBarShown] = useState(false);
  // Expiry is a change of step, not a footnote: the heading says so and takes focus, once.
  const wasEnded = useRef(ended);
  useEffect(() => {
    if (ended && !wasEnded.current) document.getElementById("code-title")?.focus();
    wasEnded.current = ended;
  }, [ended]);
  return (
    // Phones read it in order: the title, the tag, what the photo must show, the button. From 1024px the tag takes the
    // left column, beside everything else.
    <>
      <section aria-labelledby="code-title" className={clsx(STEP_GRID, "lg:grid-rows-[auto_1fr] lg:gap-y-6 [@media(max-height:600px)]:gap-5")}>
        <div className="flex items-start justify-between gap-4 lg:col-start-2">
          <StepTitle id="code-title">
            {ended ? (
              "This code has expired"
            ) : written ? (
              <>
                Write <span className="font-mono whitespace-nowrap">{written}</span> and <span className="font-mono whitespace-nowrap">{code}</span> on a piece of paper
              </>
            ) : (
              "Write this code on any piece of paper"
            )}
          </StepTitle>
          {!ended && <TimerPill left={left} className="mt-2" />}
        </div>

        {/* A dead code is struck through on a laptop and not shown on a phone: nobody should write it. */}
        <div className={clsx("lg:col-start-1 lg:row-span-2 lg:row-start-1", ended && "max-lg:hidden")}>
          <CodeTag code={code} written={written} expired={ended} foot={ended ? undefined : "Write it big, about 1\u00a0inch (3\u00a0cm), in marker."} />
          {/* What happens at 0:00, said once, under the tag the timer is for. */}
          {!ended && <p className="mt-3 text-ui text-muted">If time runs out, you&rsquo;ll get a new code.</p>}
        </div>

        <div className="flex flex-col gap-6 lg:col-start-2">
          {ended ? (
            <p role="alert" className="text-body text-pretty text-muted">
              Your refund is still waiting. Get a new code, write it on a fresh piece of paper, and take the photo within 10 minutes.
            </p>
          ) : (
            <p className="text-body text-pretty text-text">
              {written ? (
                <>
                  Photograph this paper tag with <span className="font-mono whitespace-nowrap">{written}</span> and <span className="font-mono whitespace-nowrap">{code}</span> beside the {thing} {cut ? "cut in half" : "destroyed"}.
                </>
              ) : (
                <>
                  Photograph the code <span className="font-mono whitespace-nowrap">{code}</span> beside the label{spec.label_must_show[0] ? ` (${ownerLabel(spec.label_must_show[0])})` : ""}, and the product {cut ? "cut in half" : "destroyed"}.
                </>
              )}
            </p>
          )}
          {lost && (
            <Notice role="status" tone="neutral" title="Your camera was closed">
              Photos are only kept until you send them. Open the camera to take them again.
            </Notice>
          )}
          {/* Said once on screen: while a touch phone's pinned bar is up it carries the line, so here it is only read out. */}
          {low && (
            <p role="status" className={clsx("text-ui font-medium text-text", barShown && "max-sm:pointer-coarse:sr-only")}>
              {LOW}
            </p>
          )}
          {ended ? (
            <Button key="ended" id="code-cta" href={newClaimHref} size="lg" block prefetch={false}>
              Get a new code
            </Button>
          ) : (
            <>
              {/* A laptop (a fine pointer, 640px and up): the phone's QR first, then this computer's camera, quietly. */}
              {handoff && (
                <div className="hidden flex-col gap-4 sm:pointer-fine:flex">
                  <PhoneHandoff qrSvg={qrSvg} url={phoneUrl} code={code} primary />
                  <Button variant="secondary" size="lg" block onClick={onContinue}>
                    Use this computer&rsquo;s camera
                  </Button>
                </div>
              )}
              <div className={clsx("flex flex-col gap-3", handoff && "sm:pointer-fine:hidden")}>
                <Button key="live" id="code-cta" size="lg" block onClick={onContinue}>
                  {OPEN}
                </Button>
                {/* What leaves the phone, said before the camera asks for it. Privacy opens beside the claim: its clock is running. */}
                <p className="text-ui text-pretty text-muted">
                  Only the photos you send leave your phone. They&rsquo;re used to check this claim. You can retake any photo before sending.{" "}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-link text-text underline decoration-line-strong underline-offset-4 hover:decoration-text">
                    Privacy<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </p>
              </div>
            </>
          )}
        </div>
      </section>
      {/* Touch phones: while the button is below the fold (or under Safari's toolbar), the same action waits pinned at the bottom. */}
      {/* Keyed: the button under it is a new element once the code ends, and the bar watches the one that's there. */}
      {ended ? (
        <MobileCta key="ended" target="code-cta" href={newClaimHref} label="Get a new code" />
      ) : (
        <MobileCta key="live" target="code-cta" onClick={onContinue} label={OPEN} note={low ? LOW : undefined} onShow={setBarShown} />
      )}
    </>
  );
}
