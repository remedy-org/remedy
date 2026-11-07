"use client";

import clsx from "clsx";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AlertIcon, Button, CrossIcon, ErrorState } from "@/components/ui";
import styles from "./flow.module.css";
import { CameraIcon, InfoIcon } from "./icons";
import type { ClaimStatus, ClaimView } from "./model";
import { PhoneHandoff } from "./PhoneHandoff";
import { REAL_STEPS } from "./StepMeter";
import { mmss, useCountdown } from "./useCountdown";
import { CAMERA_FRAME, CAMERA_VIEW, Cutout, Dock, GlassChip, InstructionBar, Reminders } from "./Viewfinder";

export type CameraState = "starting" | "live" | "denied" | "nocamera" | "insecure" | "error";

// Long side in px after downscaling. Three photos stay far under Vercel's 4.5 MB body limit.
const MAX_SIDE = 1600;
const QUALITY = 0.85;
const MAX_PHOTOS = 3;
const MAX_BYTES = 4.4 * 1024 * 1024;
// Each poll is one read of the claim from the store, and those are capped per month.
const POLL_MS = 5000;
// Photos sent from the phone just before the code ran out are still checked, so the poll goes on this long after it.
const POLL_GRACE_MS = 2 * 60_000;

interface Shot {
  url: string;
  blob: Blob | null;
}

export interface CapturePreview {
  camera: CameraState;
  /** Image shown in the viewfinder in place of a live feed. */
  still?: string;
  shots?: string[];
  sending?: boolean;
  sendError?: string;
  showPhone?: boolean;
}

export interface CaptureStepProps {
  claimId: string;
  sessionId: string;
  code: string;
  expiresAt: string;
  startNow: number;
  qrSvg: string;
  phoneUrl: string;
  /** Starts over with a fresh code once this session has ended. */
  newClaimHref: string;
  loginHref: string;
  /** The reminder chips along the cutout's foot, e.g. "Label", "Cut in half", "Code M4T". */
  reminders?: string[];
  /**
   * The pre-checks' answer; null when the photos had already arrived (another tab). photoUrl: an object URL of the first
   * photo sent, for the checking screen's Exhibit A, which the caller frees.
   */
  onSent(view: ClaimView | null, photoUrl?: string): void;
  /** Dev previews and screenshots: no camera, a fixed state. */
  preview?: CapturePreview;
}

const subscribeCoarse = (cb: () => void) => {
  const mq = window.matchMedia("(pointer: coarse)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** Live camera only: no upload control. Up to 3 shots, downscaled in the browser, sent with the session id. */
export function CaptureStep({ claimId, sessionId, code, expiresAt, startNow, qrSvg, phoneUrl, newClaimHref, loginHref, reminders = [], onSent, preview }: CaptureStepProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camera, setCamera] = useState<CameraState>(preview?.camera ?? "starting");
  const [attempt, setAttempt] = useState(0);
  const [shots, setShots] = useState<Shot[]>(() => (preview?.shots ?? []).map((url) => ({ url, blob: null })));
  const [sending, setSending] = useState(preview?.sending ?? false);
  const [sendError, setSendError] = useState<{ status: number; message: string } | null>(preview?.sendError ? { status: 500, message: preview.sendError } : null);
  const [flash, setFlash] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(preview?.showPhone ?? false);
  const [help, setHelp] = useState(false);
  const coarse = useSyncExternalStore(subscribeCoarse, () => window.matchMedia("(pointer: coarse)").matches, () => false);
  const left = useCountdown(expiresAt, startNow, Boolean(preview));
  const expired = left <= 0;
  const [pollOver, setPollOver] = useState(false);
  useEffect(() => {
    if (!expired || preview) return;
    const t = setTimeout(() => setPollOver(true), Math.max(0, Date.parse(expiresAt) + POLL_GRACE_MS - Date.now()));
    return () => clearTimeout(t);
  }, [expired, expiresAt, preview]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (preview || expired) return;
    let cancelled = false;
    const open = async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) return setCamera("insecure");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          // The rear camera on phones; laptops have only one.
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } },
          audio: false,
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
        }
        setCamera("live");
      } catch (e) {
        if (cancelled) return;
        const name = e instanceof DOMException ? e.name : "";
        setCamera(name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" || name === "OverconstrainedError" ? "nocamera" : "error");
      }
    };
    const t = setTimeout(open, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
      stop();
    };
  }, [attempt, expired, preview, stop]);

  // Photos can arrive from elsewhere: the phone from the QR handoff, or another tab. Poll the claim's status and move
  // on to the checking step as soon as it has photos or a decision, instead of running the camera and countdown on
  // regardless. Not while the tab is hidden, and not past POLL_GRACE_MS after the session ended.
  const onSentRef = useRef(onSent);
  const sendingRef = useRef(sending);
  useEffect(() => {
    onSentRef.current = onSent;
    sendingRef.current = sending;
  });
  useEffect(() => {
    if (preview || pollOver) return;
    let done = false;
    const poll = async () => {
      if (done || sendingRef.current || document.hidden) return;
      try {
        const res = await fetch(`/api/claims/${claimId}/status`, { cache: "no-store" });
        if (!res.ok || done || sendingRef.current) return;
        const status = (await res.json()) as ClaimStatus;
        if (status.photos > 0 || status.decision !== "pending") {
          done = true;
          stop();
          // The checking step fetches the checklist itself.
          onSentRef.current(null);
        }
      } catch {
        // Offline for a moment: the next tick tries again.
      }
    };
    const t = setInterval(poll, POLL_MS);
    // Back on this tab after taking the photos on the phone: look now rather than at the next tick.
    const onVisible = () => void poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      done = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [claimId, pollOver, preview, stop]);

  // Object URLs for the thumbnails are freed when the step goes away.
  const shotsRef = useRef(shots);
  useEffect(() => {
    shotsRef.current = shots;
  }, [shots]);
  useEffect(() => () => shotsRef.current.forEach((s) => s.blob && URL.revokeObjectURL(s.url)), []);

  async function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || shots.length >= MAX_PHOTOS) return;
    const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob) return;
    setShots((s) => [...s, { url: URL.createObjectURL(blob), blob }]);
    // The flash: white at 50%, 40ms in and 200ms out (flow.module.css).
    setFlash(true);
    setTimeout(() => setFlash(false), 40);
  }

  // Laptops: the space bar is the shutter, unless focus is on something space already presses or types into.
  const captureRef = useRef(capture);
  useEffect(() => {
    captureRef.current = capture;
  });
  useEffect(() => {
    if (preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || e.defaultPrevented) return;
      if (e.target instanceof Element && e.target.closest("button, a, input, textarea, select, summary, [contenteditable]")) return;
      e.preventDefault();
      void captureRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  function remove(i: number) {
    setShots((s) => {
      const gone = s[i];
      if (gone?.blob) URL.revokeObjectURL(gone.url);
      return s.filter((_, j) => j !== i);
    });
  }

  async function send() {
    const blobs = shots.map((s) => s.blob).filter((b): b is Blob => b !== null);
    if (!blobs.length || sending) return;
    if (blobs.reduce((n, b) => n + b.size, 0) > MAX_BYTES) {
      setSendError({ status: 413, message: "These photos are too large to send together. Remove one and try again." });
      return;
    }
    setSending(true);
    setSendError(null);
    const form = new FormData();
    form.set("sessionId", sessionId);
    blobs.forEach((b, i) => form.append("photo", b, `photo-${i + 1}.jpg`));
    try {
      const res = await fetch(`/api/claims/${claimId}/photos`, { method: "POST", body: form });
      const body = await res.json().catch(() => null);
      if (res.status === 409) {
        stop();
        return onSent(null);
      }
      if (!res.ok) {
        setSendError({ status: res.status, message: body?.error ?? "The photos didn't send. Try again." });
        setSending(false);
        return;
      }
      stop();
      // A fresh URL for the checking screen's Exhibit A: this step frees its own thumbnails' URLs when it goes away.
      onSent(body as ClaimView, URL.createObjectURL(blobs[0]));
    } catch {
      setSendError({ status: 0, message: "No connection. Your photos are still here: send them again when you're back online." });
      setSending(false);
    }
  }

  const live = camera === "live" && !expired;
  const n = shots.length;
  const showPhone = !coarse && (phoneOpen || (!expired && (camera === "denied" || camera === "nocamera" || camera === "insecure")));
  const sendLabel = `Send ${n === 1 ? "photo" : `${n} photos`}`;
  const helpText = n === 0 ? "Live camera only: there's no upload button. Up to 3 photos; one with all of it is fine." : `${n} of ${MAX_PHOTOS} taken. Send once the label, the cut and the code are all in.`;

  return (
    <section aria-labelledby="capture-title" className="mx-auto flex w-full max-w-[40rem] flex-col gap-5">
      {/* The camera is dark in both themes, like a camera's. Full bleed on a phone, a 4:3 frame on a laptop. */}
      <div data-theme="dark" data-camera="" className={CAMERA_FRAME}>
        <div className={CAMERA_VIEW}>
          <video ref={videoRef} playsInline muted aria-label="Camera preview" className={clsx("absolute inset-0 size-full object-cover", !live && "invisible")} />
          {preview?.still && live && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview.still} alt="" className="absolute inset-0 size-full object-cover" />
          )}
          {live ? (
            <Cutout>
              <GlassChip className="absolute top-2 left-2">Exhibit A</GlassChip>
              <Reminders items={reminders} />
            </Cutout>
          ) : (
            <Cutout dashed>
              <FrameMessage
                camera={expired || camera === "live" ? "expired" : camera}
                onRetry={() => {
                  setCamera("starting");
                  setAttempt((a) => a + 1);
                }}
              />
            </Cutout>
          )}
          {/* Phones: the step meter, as one chip (StepMeter hides itself here). */}
          <GlassChip className="absolute top-3 left-3 sm:hidden">
            3/{REAL_STEPS.length} · {REAL_STEPS[2]}
          </GlassChip>
          <div className="absolute top-3 right-3">
            <GlassChip className={clsx(left < 60_000 && !expired && "text-accent-text")}>
              <span role="timer" aria-live="off" aria-label={expired ? "The camera session has ended" : `${mmss(left)} left on the camera session`} className={clsx(!expired && left < 10_000 && styles.urgent)}>
                {expired ? "Ended" : mmss(left)}
              </span>
            </GlassChip>
          </div>
          <div aria-hidden="true" className={clsx("pointer-events-none absolute inset-0 bg-[oklch(1_0_0)]", flash ? clsx("opacity-50", styles.flashOn) : clsx("opacity-0", styles.flashOff))} />
        </div>

        <InstructionBar className="max-sm:gap-1 max-sm:pr-1">
          <div className="flex flex-col gap-1">
            <h2 id="capture-title" tabIndex={-1} className="text-ui font-medium text-balance text-[oklch(0.96_0.005_255)] outline-none focus-visible:outline-2 focus-visible:outline-offset-4">
              Fit the label, the destroyed product and the code <span className="font-mono">{code}</span> in the frame
            </h2>
            {help && (
              <p id="capture-help" className="text-ui text-balance text-[oklch(0.72_0.012_255)] sm:hidden">
                {helpText}
              </p>
            )}
          </div>
          {!expired && (
            <button
              type="button"
              onClick={() => setHelp((h) => !h)}
              aria-expanded={help}
              aria-controls="capture-help"
              aria-label="About the camera"
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-[oklch(0.72_0.012_255)] hover:text-[oklch(0.96_0.005_255)] sm:hidden"
            >
              <InfoIcon />
            </button>
          )}
        </InstructionBar>

        <Dock
          className="border-t border-[oklch(1_0_0/0.08)]"
          left={
            <ul className="flex gap-2.5" aria-label={`${n} of ${MAX_PHOTOS} photos taken`}>
              {Array.from({ length: MAX_PHOTOS }, (_, i) => (
                <li key={i} className="relative size-12 shrink-0 sm:size-14">
                  {shots[i] ? (
                    <>
                      <span className={clsx("block size-full rounded-control bg-paper p-[2px] shadow-paper", styles.drop)}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={shots[i].url} alt={`Photo ${i + 1}`} className="size-full rounded-[3px] object-cover" />
                      </span>
                      {/* The letter and the remove button sit inside the print's corners, so neighbours never collide. */}
                      <span aria-hidden="true" className="absolute bottom-[3px] left-[3px] flex size-4 items-center justify-center rounded-[3px] bg-accent font-mono text-[10px] leading-none font-semibold text-accent-ink">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <button
                        type="button"
                        onClick={() => remove(i)}
                        disabled={sending}
                        aria-label={`Remove photo ${i + 1}`}
                        className="absolute top-[3px] right-[3px] flex size-5 items-center justify-center rounded-full bg-[oklch(0.12_0.01_255/0.8)] text-[oklch(0.96_0.005_255)] after:absolute after:-inset-3 after:content-[''] disabled:opacity-40"
                      >
                        <CrossIcon size={12} />
                      </button>
                    </>
                  ) : (
                    <span className="flex size-full items-center justify-center rounded-control border border-dashed border-[oklch(1_0_0/0.25)] font-mono text-micro text-[oklch(0.72_0.012_255)]">{i + 1}</span>
                  )}
                </li>
              ))}
            </ul>
          }
          middle={
            expired ? null : (
              <>
                <button
                  type="button"
                  onClick={capture}
                  disabled={!live || sending || n >= MAX_PHOTOS}
                  aria-label={n >= MAX_PHOTOS ? "Three photos taken" : `Take photo ${n + 1} of ${MAX_PHOTOS}`}
                  aria-keyshortcuts="Space"
                  className={clsx(
                    "flex size-[4.5rem] items-center justify-center rounded-full border-4 border-[oklch(1_0_0/0.9)] transition-opacity duration-160 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:opacity-35",
                    styles.shutter,
                  )}
                >
                  <span className="size-[3.625rem] rounded-full bg-[oklch(1_0_0)]" />
                </button>
                <span aria-hidden="true" className="hidden font-mono text-micro text-[oklch(0.72_0.012_255)] sm:pointer-fine:inline-flex">
                  <kbd className="rounded-[4px] border border-[oklch(1_0_0/0.25)] px-1.5 py-px">Space</kbd>
                </span>
              </>
            )
          }
          right={
            n > 0 &&
            !expired && (
              <Button onClick={send} pending={sending} pendingLabel="Sending…" aria-label={sendLabel} className={clsx("max-sm:px-3", styles.rise)}>
                <span className="sm:hidden">Send</span>
                <span className="max-sm:hidden">{sendLabel}</span>
              </Button>
            )
          }
        />
        <p className="sr-only" aria-live="polite">
          {n === 0 ? "" : n < MAX_PHOTOS ? `Photo ${n} taken. You can take ${MAX_PHOTOS - n} more.` : "Three photos taken. Send them, or remove one to retake it."}
        </p>
      </div>

      {sendError && (
        <ErrorState
          variant="inline"
          title={sendError.status === 401 ? "Your PayPal login has expired" : "The photos didn't send"}
          description={sendError.status === 401 ? "Log in again to send them. You'll need to retake them afterwards." : sendError.message}
          action={sendError.status === 401 ? <Button href={loginHref} variant="secondary" size="sm">Log in with PayPal</Button> : undefined}
        />
      )}

      {expired ? (
        <Button href={newClaimHref} size="lg" block prefetch={false}>
          Get a new code
        </Button>
      ) : (
        // On a phone this lives behind the (i) in the instruction bar, so the camera keeps the whole screen.
        <p className="text-ui text-muted max-sm:hidden">{helpText}</p>
      )}

      {/* Laptops only: on a phone this already is the phone. */}
      {!coarse && !expired && (
        <div className="max-sm:hidden">
          {showPhone ? (
            <PhoneHandoff qrSvg={qrSvg} url={phoneUrl} code={code} />
          ) : (
            <Button variant="tertiary" size="sm" onClick={() => setPhoneOpen(true)}>
              Use your phone&apos;s camera instead
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

const MESSAGES: Record<Exclude<CameraState, "live"> | "expired", { title: string; body: string; retry?: boolean; tone?: "stop" }> = {
  starting: { title: "Waiting for the camera", body: "Your browser will ask to use it. Choose Allow." },
  denied: { title: "Camera access is blocked", body: "Allow the camera for this site from the icon in the address bar, then try again.", retry: true, tone: "stop" },
  nocamera: { title: "No camera found", body: "This device has no camera Remedy can use. Photos can only come from a live camera, never a file." },
  insecure: { title: "The camera needs a secure page", body: "Browsers only open the camera over https. Open this page's https address, or use your phone." },
  error: { title: "The camera didn't start", body: "Another app may be using it. Close that app, then try again.", retry: true, tone: "stop" },
  expired: { title: "Your 10 minutes are up", body: "Codes only last 10 minutes, so photos can't be prepared in advance. Get a new code to start again." },
};

function FrameMessage({ camera, onRetry }: { camera: Exclude<CameraState, "live"> | "expired"; onRetry(): void }) {
  const m = MESSAGES[camera];
  return (
    <div role={camera === "starting" ? "status" : "alert"} className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
      <span className={clsx("flex size-10 items-center justify-center rounded-full border", m.tone === "stop" ? "border-stop text-stop" : "border-line-strong text-muted", camera === "starting" && "animate-[skeleton-pulse_1.6s_ease-in-out_infinite]")}>
        {m.tone === "stop" ? <AlertIcon /> : <CameraIcon />}
      </span>
      <p className="text-body font-semibold text-text">{m.title}</p>
      <p className="max-w-80 text-ui text-muted">{m.body}</p>
      {m.retry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-1">
          Try again
        </Button>
      )}
    </div>
  );
}
