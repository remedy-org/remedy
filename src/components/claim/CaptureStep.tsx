"use client";

import clsx from "clsx";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { AlertIcon, ArrowLeftIcon, Button } from "@/components/ui";
import styles from "./flow.module.css";
import { rememberAspect } from "./ClaimPhotos";
import { CodeTag } from "./CodeTag";
import { MonoWords } from "./CheckList";
import { firstShown, focusInView } from "./FocusTitle";
import { InfoIcon } from "./icons";
import { coverCrop, photosTakenKey, type ClaimView } from "./model";
import { PhoneHandoff } from "./PhoneHandoff";
import { useClaimArrival } from "./useClaimArrival";
import { mmss, useCountdown } from "./useCountdown";
import { CAMERA_BACK, CAMERA_FRAME, CameraTopBar, Cutout, Dock, GlassChip, InstructionBar } from "./Viewfinder";

export type CameraState = "starting" | "live" | "denied" | "nocamera" | "insecure" | "error";

// Long side in px after downscaling. Three photos stay far under Vercel's 4.5 MB body limit.
const MAX_SIDE = 1600;
const QUALITY = 0.85;
const MAX_PHOTOS = 3;
const MAX_BYTES = 4.4 * 1024 * 1024;

interface Shot {
  url: string;
  blob: Blob | null;
  /** Its size, so the checking screen draws it at its own shape from the first frame. */
  w?: number;
  h?: number;
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
  /** What the photo needs, the instruction bar's one line: "Photograph your paper tag with X-VESOLJE M4T beside the pillow cut in half." */
  reminder: string;
  /** The label hand-written on the tag beside the code, for the tag shown beside the camera on a laptop. */
  written?: string | null;
  /** What the photo frames, in the code step's words: the "paper tag" (or "label") and the "cut pillow" (or "destroyed product"). */
  framing?: { thing: string; product: string };
  /**
   * The pre-checks' answer; null when the photos had already arrived (another tab). photoUrls: object URLs of the photos
   * sent, in order, for the checking screen, which the caller frees.
   */
  onSent(view: ClaimView | null, photoUrls?: string[]): void;
  /** Back to the code step (the code and its timer), from the camera's top bar or a camera that won't open. */
  onBack(): void;
  /** Dev previews and screenshots: no camera, a fixed state. */
  preview?: CapturePreview;
}

const subscribeCoarse = (cb: () => void) => {
  const mq = window.matchMedia("(pointer: coarse)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

type Platform = "ios" | "android" | "other";
const noop = () => () => {};
// iPadOS reports itself as a Mac, with touch.
const platformOf = (): Platform => {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  return /Android/.test(ua) ? "android" : "other";
};

/** Live camera only: no upload control. Up to 3 shots, downscaled in the browser, sent with the session id. */
export function CaptureStep({ claimId, sessionId, code, expiresAt, startNow, qrSvg, phoneUrl, newClaimHref, loginHref, reminder, written, framing = { thing: "label", product: "destroyed product" }, onSent, onBack, preview }: CaptureStepProps) {
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
  // The photo open full size, to check it before sending, or retake it.
  const [viewing, setViewing] = useState<number | null>(null);
  const viewerRef = useRef<HTMLDialogElement>(null);
  // "Back to your code" with photos not yet sent: asked first, since going back drops them.
  const leaveRef = useRef<HTMLDialogElement>(null);
  const shutterRef = useRef<HTMLButtonElement>(null);
  const trayRef = useRef<HTMLUListElement>(null);
  // A retake hands focus to the shutter once the slot is gone, so it never drops to the page.
  const refocus = useRef(false);
  // What the live region last said: a photo taken, or the one a retake removed.
  const [removed, setRemoved] = useState<number | null>(null);
  const coarse = useSyncExternalStore(subscribeCoarse, () => window.matchMedia("(pointer: coarse)").matches, () => false);
  const platform = useSyncExternalStore(noop, platformOf, () => "other" as const);
  const left = useCountdown(expiresAt, startNow, Boolean(preview));
  const expired = left <= 0;

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

  // The camera won't open: focus lands on why, so a keyboard or screen reader hears it before anything else.
  useEffect(() => {
    if (camera === "denied" || camera === "nocamera" || camera === "insecure" || camera === "error") focusInView(firstShown("camera-message"));
  }, [camera]);

  // "Use your phone's camera instead" on a laptop: the QR opens under the frame, so it's brought into view and focused.
  useEffect(() => {
    if (!phoneOpen || preview) return;
    const el = document.getElementById("phone-handoff");
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
    el.focus({ preventScroll: true });
  }, [phoneOpen, preview]);

  // Photos sent from the phone or another tab: on to the checking step, with the claim as it now stands.
  useClaimArrival(
    claimId,
    expiresAt,
    (view) => {
      stop();
      onSent(view);
    },
    { off: Boolean(preview), paused: sending },
  );

  // showModal() moves focus to the dialog's first control (Retake) and ignores React's autoFocus, so Keep, the primary
  // action, takes focus after it: a reflexive Enter keeps the photo.
  useEffect(() => {
    const d = viewerRef.current;
    if (viewing === null || !d || d.open) return;
    d.showModal();
    d.querySelector<HTMLButtonElement>("[data-keep]")?.focus();
  }, [viewing]);

  // Object URLs for the thumbnails are freed when the step goes away.
  const shotsRef = useRef(shots);
  useEffect(() => {
    shotsRef.current = shots;
  }, [shots]);
  useEffect(() => () => shotsRef.current.forEach((s) => s.blob && URL.revokeObjectURL(s.url)), []);

  // Unsent photos live only in this tab: a note for the code step, in case a reload (or iOS reclaiming the tab) drops them.
  const taken = shots.some((s) => s.blob);
  useEffect(() => {
    if (preview) return;
    try {
      if (taken) sessionStorage.setItem(photosTakenKey(claimId), "1");
      else sessionStorage.removeItem(photosTakenKey(claimId));
    } catch {
      // No storage (a private window, blocked site data): the note is a nicety.
    }
  }, [taken, claimId, preview]);
  const sentAll = () => {
    try {
      sessionStorage.removeItem(photosTakenKey(claimId));
    } catch {
      // As above.
    }
  };

  async function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || shots.length >= MAX_PHOTOS) return;
    // What the viewfinder shows (object-cover crops the feed to its box) is what's saved and checked: the same crop.
    const { sx, sy, sw, sh } = coverCrop(video.videoWidth, video.videoHeight, video.clientWidth, video.clientHeight);
    const scale = Math.min(1, MAX_SIDE / Math.max(sw, sh));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw * scale);
    canvas.height = Math.round(sh * scale);
    canvas.getContext("2d")?.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob) return;
    setShots((s) => [...s, { url: URL.createObjectURL(blob), blob, w: canvas.width, h: canvas.height }]);
    setRemoved(null);
    // The flash: white at 50%, 40ms in and 200ms out (flow.module.css). Motion: a reduced-motion setting skips it.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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
    setRemoved(i + 1);
  }

  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    const shutter = shutterRef.current;
    if (shutter && !shutter.disabled) shutter.focus();
    else trayRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [shots]);

  const back = () => {
    if (shots.length > 0) {
      leaveRef.current?.showModal();
      // showModal() focuses Leave, the first control: the safe choice, Keep taking photos, takes it instead.
      leaveRef.current?.querySelector<HTMLButtonElement>("[data-stay]")?.focus();
    } else onBack();
  };

  async function send() {
    const blobs = shots.map((s) => s.blob).filter((b): b is Blob => b !== null);
    if (!blobs.length || sending) return;
    if (blobs.reduce((n, b) => n + b.size, 0) > MAX_BYTES) {
      setSendError({ status: 413, message: blobs.length === 1 ? "This photo is too large to send. Retake it and try again." : "These photos are too large to send together. Remove one and try again." });
      return;
    }
    setSending(true);
    setSendError(null);
    // One photo is said as one, in the error as in the button.
    const one = shots.length === 1;
    const form = new FormData();
    form.set("sessionId", sessionId);
    blobs.forEach((b, i) => form.append("photo", b, `photo-${i + 1}.jpg`));
    try {
      const res = await fetch(`/api/claims/${claimId}/photos`, { method: "POST", body: form });
      const body = await res.json().catch(() => null);
      if (res.status === 409) {
        stop();
        sentAll();
        return onSent(null);
      }
      if (!res.ok) {
        setSendError({ status: res.status, message: body?.error ?? (one ? "The photo didn’t send. Try again." : "The photos didn’t send. Try again.") });
        setSending(false);
        return;
      }
      stop();
      sentAll();
      shots.forEach((s, i) => s.w && s.h && rememberAspect(claimId, i + 1, s.w, s.h));
      // Fresh URLs for the checking screen: this step frees its own thumbnails' URLs when it goes away.
      onSent(body as ClaimView, blobs.map((b) => URL.createObjectURL(b)));
    } catch {
      setSendError({
        status: 0,
        message: one ? "No connection. Your photo is still here: send it again when you’re back online." : "No connection. Your photos are still here: send them again when you’re back online.",
      });
      setSending(false);
    }
  }

  const live = camera === "live" && !expired;
  // The camera won't open here: no shutter, and no empty dock under the message that says why.
  const failed = camera === "denied" || camera === "nocamera" || camera === "insecure" || camera === "error";
  const n = shots.length;
  const showPhone = !coarse && (phoneOpen || (!expired && (camera === "denied" || camera === "nocamera" || camera === "insecure")));
  const sendLabel = `Send ${n === 1 ? "photo" : `${n} photos`}`;
  const timerLabel = `${mmss(left)} left to take the photo`;
  // Said before the first shot, not behind (i): one photo is enough, so nobody thinks the three slots must be filled.
  const helpText = n === 0 ? `One photo of the ${framing.thing} and the ${framing.product} is enough.` : "Open a photo to check it or retake it.";
  const errorTitle = sendError?.status === 401 ? "Your PayPal login has expired" : n === 1 ? "The photo didn’t send" : "The photos didn’t send";
  const errorText = sendError?.status === 401 ? (n === 1 ? "Log in again to send it. You’ll need to retake it afterwards." : "Log in again to send them. You’ll need to retake them afterwards.") : sendError?.message;
  const shown = viewing !== null ? shots[viewing] : undefined;
  const said = sending
    ? `Sending your ${n === 1 ? "photo" : "photos"}…`
    : removed !== null
      ? `Photo ${removed} removed. You can take ${MAX_PHOTOS - n} more.`
      : n === 0
        ? ""
        : n < MAX_PHOTOS
          ? `Photo ${n} taken. You can take ${MAX_PHOTOS - n} more.`
          : "Three photos taken. Send them, or open one to retake it.";

  return (
    // From 1024px the step grid: the camera in the left column (where the photo stays through the checks and the result),
    // the instruction, the tag and the phone's QR on the right. A phone's camera is the whole screen.
    <section aria-label={expired ? `Code ${code} has expired` : reminder} className="grid w-full max-w-[40rem] items-start gap-5 lg:max-w-none lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-6">
      {/* A laptop's right column: what to photograph, said once, beside the tag it should show. First in the page's order
          (the frame is placed in the left column), so Tab from the title goes on to the photos, the shutter and Send. */}
      <div className="hidden flex-col gap-6 lg:col-start-2 lg:row-start-1 lg:flex">
        {failed && n === 0 && !expired ? (
          <p className="text-body text-pretty text-muted">
            <MonoWords words={[written, code]}>{reminder}</MonoWords>
          </p>
        ) : (
          // Expired, the frame's message says it ("Your 10 minutes are up"): the title is only read, and still takes focus.
          <h1
            id="capture-title-wide"
            tabIndex={-1}
            className={clsx("text-title font-medium text-balance text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-4", expired && "sr-only")}
          >
            {expired ? (
              <>
                Code <span className="font-mono">{code}</span> has expired
              </>
            ) : (
              <MonoWords words={[written, code]}>{reminder}</MonoWords>
            )}
          </h1>
        )}
        <CodeTag code={code} written={written} expired={expired} />
        {!expired && !failed && <p className="text-ui text-muted">{`${helpText}${n === 0 && !coarse ? " Space takes a photo." : ""}`}</p>}
      </div>
      {/* The camera is dark in both themes, like a camera's. Full bleed on a phone, a 4:3 frame on a laptop. */}
      <div data-theme="dark" data-camera="" className={clsx(CAMERA_FRAME, "lg:col-start-1 lg:row-span-2 lg:row-start-1")}>
        <CameraTopBar
          back={
            <button type="button" onClick={back} className={CAMERA_BACK}>
              {/* Expired, the code it would go back to is dead: just the way back. */}
              <ArrowLeftIcon className="shrink-0" /> {expired ? "Back" : "Back to your code"}
            </button>
          }
        >
          {/* The code and its time left, in one place: below 1024px this bar is where they're read. */}
          <span className="text-[oklch(0.96_0.006_85)]">
            <span className="sr-only">Code </span>
            <span className="font-mono">{code}</span>
            {!expired && (
              <>
                <span aria-hidden="true" className="text-[oklch(0.74_0.005_80)]">
                  {" · "}
                </span>
                <span role="timer" aria-live="off" aria-label={timerLabel} className={clsx(left < 10_000 && styles.urgent)}>
                  <span className="font-mono">{mmss(left)}</span> left
                </span>
              </>
            )}
          </span>
        </CameraTopBar>
        {/* A camera that won't open gives up the 4:3 frame on a laptop: the message, not an empty black box. */}
        <div className={clsx("relative overflow-hidden max-sm:min-h-0 sm:w-full", failed && n === 0 && !expired ? "sm:min-h-56" : "sm:aspect-[4/3] sm:max-h-[55svh] [@media(max-height:600px)]:max-h-[40svh]")}>
          <video ref={videoRef} playsInline muted aria-label="Camera preview" className={clsx("absolute inset-0 size-full object-cover", !live && "invisible")} />
          {preview?.still && live && (
            // Dev previews only: a still in place of the feed.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview.still} alt="" className="absolute inset-0 size-full object-cover object-[50%_72%]" />
          )}
          {live ? (
            <Cutout>
              {/* The photo the shutter takes next, numbered as the slots below are; opposite it, the time left. */}
              {n < MAX_PHOTOS && <GlassChip className="absolute top-2 left-2">{n === 0 ? "Photo 1" : `Next: photo ${n + 1}`}</GlassChip>}
              {/* From 1024px the camera's bar steps aside: the time left is here, opposite the photo's number. */}
              <GlassChip className={clsx("absolute top-2 right-2 max-lg:hidden", left < 60_000 && "font-medium", left < 10_000 && styles.urgent)}>
                <span role="timer" aria-live="off" aria-label={timerLabel}>
                  <span className="font-mono">{mmss(left)}</span> left
                </span>
              </GlassChip>
            </Cutout>
          ) : (
            // Why there's no picture, said inside the frame where the picture would be, with the way forward.
            <FrameMessage
              camera={expired || camera === "live" ? "expired" : camera}
              platform={platform}
              device={coarse ? "your phone" : "this computer"}
              phone={coarse}
              left={left}
              handoff={coarse && failed && !expired ? <PhoneHandoff qrSvg={qrSvg} url={phoneUrl} code={code} /> : undefined}
              collapsed={failed && n === 0 && !expired}
              onBack={failed && n === 0 && !expired ? onBack : undefined}
              onRetry={() => {
                setCamera("starting");
                setAttempt((a) => a + 1);
              }}
            />
          )}
          {/* The time left stays in its corner while the camera won't open, as it does over the feed. */}
          {!live && !expired && (
            <GlassChip className={clsx("absolute top-2 right-2 z-10 max-lg:hidden", left < 60_000 && "font-medium")}>
              <span role="timer" aria-live="off" aria-label={timerLabel}>
                <span className="font-mono">{mmss(left)}</span> left
              </span>
            </GlassChip>
          )}
          {/* Phones: a one-line hint, or the longer help from (i), over the foot of the feed, so the viewfinder never
              resizes (and the guide never moves) as they come and go. */}
          <p
            id="capture-help"
            hidden={!(help || (n === 0 && live)) || Boolean(sendError) || expired}
            className="absolute inset-x-3 bottom-3 z-10 rounded-control bg-[oklch(0.12_0.004_75/0.86)] px-3 py-2 text-ui text-pretty text-[oklch(0.86_0.005_80)] backdrop-blur-sm sm:hidden"
          >
            {helpText}
          </p>
          <div aria-hidden="true" className={clsx("pointer-events-none absolute inset-0 bg-[oklch(1_0_0)]", flash ? clsx("opacity-50", styles.flashOn) : clsx("opacity-0", styles.flashOff))} />
        </div>

        {/* What to photograph, under the frame; a laptop has it in the right column instead. A camera that won't open has
            no photo to describe: its message in the frame is the heading then. */}
        {/* Expired, the frame's message is the one said on screen: the bar and its title are only read (and the title
            still takes focus). */}
        <InstructionBar className={clsx("max-sm:gap-1 max-sm:pr-1", failed && n === 0 && !expired ? "hidden" : !sendError && "lg:hidden", expired && !sendError && "sr-only")}>
          <div className="flex flex-col gap-1">
            <h1 id="capture-title" tabIndex={-1} className={clsx("text-ui font-medium text-balance text-[oklch(0.96_0.006_85)] outline-none focus-visible:outline-2 focus-visible:outline-offset-4", sendError && "sr-only lg:hidden")}>
              {expired ? (
                <>
                  Code <span className="font-mono">{code}</span> has expired
                </>
              ) : (
                <MonoWords words={[written, code]}>{reminder}</MonoWords>
              )}
            </h1>
            {/* A failed send says so here, on the first screen, where the Send button is. */}
            {sendError && (
              <div role="alert" className="flex items-start gap-2.5 text-left">
                <AlertIcon className="mt-0.5 shrink-0 text-stop" />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-ui font-medium text-[oklch(0.96_0.006_85)]">{errorTitle}</p>
                  <p className="text-ui text-pretty text-[oklch(0.74_0.005_80)]">{errorText}</p>
                  {sendError.status === 401 && (
                    <Button href={loginHref} variant="secondary" size="sm" className="mt-2 self-start">
                      Log in with PayPal
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
          {/* Before the first shot the hint is open anyway, so (i) would do nothing: it keeps its place but is hidden (and
              out of the Tab order, so Tab from the title goes to the shutter), and from the first shot it toggles. */}
          {!expired && !sendError && (
            <button
              type="button"
              onClick={() => setHelp((h) => !h)}
              aria-expanded={help}
              aria-controls="capture-help"
              aria-label="About the camera"
              className={clsx(
                "flex size-11 shrink-0 items-center justify-center rounded-full text-[oklch(0.74_0.005_80)] hover:text-[oklch(0.96_0.006_85)] sm:hidden",
                n === 0 && live && "invisible",
              )}
            >
              <InfoIcon />
            </button>
          )}
        </InstructionBar>

        {!(failed && n === 0 && !expired) && (
          <Dock
            short={expired}
            className="border-t border-[oklch(1_0_0/0.08)]"
            left={
              expired ? null : (
                // A laptop's frame is 448px wide: three 44px slots leave the shutter its own column.
                <ul ref={trayRef} className="flex gap-2.5 lg:gap-2" aria-label={`${n} of ${MAX_PHOTOS} photos taken`}>
                  {Array.from({ length: MAX_PHOTOS }, (_, i) => (
                    <li key={i} className="relative size-12 shrink-0 sm:size-14 lg:size-11">
                      {shots[i] ? (
                        <button
                          type="button"
                          onClick={() => setViewing(i)}
                          aria-haspopup="dialog"
                          aria-label={`Photo ${i + 1}: open it to check it or retake it`}
                          className="relative block size-full rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                        >
                          {/* The latest shot wears a 2px white ring: the one to open and check. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={shots[i].url} alt="" className={clsx("block size-full rounded-control object-cover", i === n - 1 ? "ring-2 ring-[oklch(1_0_0)]" : "ring-1 ring-[oklch(1_0_0/0.18)]", styles.drop)} />
                        </button>
                      ) : (
                        // The next slot is a plain outline; the ones after it are dashed and fainter: room for more,
                        // never a row of three to fill.
                        <span className={clsx("block size-full rounded-control border", i === n ? "border-[oklch(1_0_0/0.18)]" : "border-dashed border-[oklch(1_0_0/0.1)]")} />
                      )}
                    </li>
                  ))}
                </ul>
              )
            }
            middle={
              expired ? (
                // The session is over: the way forward takes the shutter's place.
                <Button href={newClaimHref} size="lg" prefetch={false}>
                  Get a new code
                </Button>
              ) : failed ? null : (
                <>
                  <button
                    ref={shutterRef}
                    type="button"
                    onClick={capture}
                    disabled={!live || sending || n >= MAX_PHOTOS}
                    aria-label={n >= MAX_PHOTOS ? "Three photos taken" : n === 0 ? "Take a photo" : "Take another photo"}
                    aria-keyshortcuts="Space"
                    className={clsx(
                      "peer flex size-[4.5rem] items-center justify-center rounded-full border-4 border-[oklch(1_0_0/0.9)] transition-opacity duration-160 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus disabled:opacity-35",
                      styles.shutter,
                    )}
                  >
                    <span className="size-[3.625rem] rounded-full bg-[oklch(1_0_0)]" />
                  </button>
                  {/* The keyboard's shutter, shown only to a keyboard on the shutter. */}
                  <span aria-hidden="true" className="hidden font-mono text-micro text-[oklch(0.74_0.005_80)] sm:pointer-fine:peer-focus-visible:inline-flex">
                    <kbd className="rounded-[4px] border border-[oklch(1_0_0/0.25)] px-1.5 py-px">Space</kbd>
                  </span>
                </>
              )
            }
            right={
              n > 0 &&
              !expired && (
                // Busy, not disabled, while the photos go: focus stays here until the checking screen's heading takes it.
                <Button onClick={send} aria-busy={sending || undefined} data-pending={sending ? "" : undefined} aria-label={sending || sendError ? undefined : sendLabel} className={clsx("max-sm:px-3", styles.rise)}>
                  {/* "Sending…" at every size: "Sending 2 photos…" and its arc would run into the shutter in a laptop's frame. */}
                  {sending ? (
                    <span className="inline-flex items-center gap-2">
                      <span aria-hidden="true" className={clsx("size-3.5 shrink-0 rounded-full border-2 border-current border-r-transparent", styles.turn)} />
                      Sending…
                    </span>
                  ) : sendError ? (
                    "Send again"
                  ) : (
                    <>
                      <span className="sm:hidden">Send</span>
                      <span className="max-sm:hidden">{sendLabel}</span>
                    </>
                  )}
                </Button>
              )
            }
          />
        )}
        <p className="sr-only" aria-live="polite">
          {said}
        </p>

        {/* A photo full size: check the label, the cut and the code are sharp, then keep it or retake it. */}
        <dialog
          ref={viewerRef}
          aria-label={viewing !== null ? `Photo ${viewing + 1}` : "Photo"}
          onClose={() => setViewing(null)}
          onClick={(e) => e.target === viewerRef.current && viewerRef.current?.close()}
          className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[min(calc(100%-2rem),40rem)] max-w-none overflow-y-auto rounded-card bg-surface p-0 text-text shadow-float backdrop:bg-[oklch(0_0_0/0.7)]"
        >
          {shown && viewing !== null && (
            <div className="flex flex-col gap-4 p-4">
              <GlassChip className="self-start">
                Photo {viewing + 1} of {n}
              </GlassChip>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shown.url} alt={`Photo ${viewing + 1}, full size`} className="max-h-[60dvh] w-full rounded-control bg-[oklch(0.12_0.004_75)] object-contain" />
              <p className="text-ui text-pretty text-[oklch(0.74_0.005_80)]">
                Check that the {framing.thing}, the {framing.product} and the code <span className="font-mono text-[oklch(0.96_0.006_85)]">{code}</span> are all in and sharp.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="secondary"
                  size="lg"
                  disabled={sending}
                  onClick={() => {
                    remove(viewing);
                    refocus.current = true;
                    viewerRef.current?.close();
                  }}
                >
                  Retake
                </Button>
                <Button size="lg" data-keep="" onClick={() => viewerRef.current?.close()}>
                  Keep
                </Button>
              </div>
            </div>
          )}
        </dialog>

        {/* Back with photos not yet sent: they live only in this tab, so going back drops them. Said before it happens. */}
        <dialog
          ref={leaveRef}
          aria-labelledby="leave-title"
          aria-describedby="leave-text"
          onClick={(e) => e.target === leaveRef.current && leaveRef.current?.close()}
          className="fixed inset-0 m-auto w-[min(calc(100%-2rem),26rem)] max-w-none rounded-card bg-surface p-0 text-text shadow-float backdrop:bg-[oklch(0_0_0/0.7)]"
        >
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-1">
              <p id="leave-title" className="text-body font-medium text-text">
                Leave the camera?
              </p>
              <p id="leave-text" className="text-ui text-pretty text-[oklch(0.74_0.005_80)]">
                {n === 1 ? "Your photo isn’t sent yet and will be lost." : `Your ${n} photos aren’t sent yet and will be lost.`}
              </p>
            </div>
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
              <Button
                variant="secondary"
                size="lg"
                onClick={() => {
                  leaveRef.current?.close();
                  onBack();
                }}
              >
                Leave
              </Button>
              <Button size="lg" data-stay="" onClick={() => leaveRef.current?.close()}>
                Keep taking photos
              </Button>
            </div>
          </div>
        </dialog>
      </div>

      {/* Laptops only: on a phone this already is the phone. */}
      {!coarse && !expired && (
        <div id="phone-handoff" tabIndex={-1} aria-label={showPhone ? "Take the photo on your phone" : undefined} className="rounded-control outline-none focus:outline-2 focus:outline-offset-4 focus:outline-focus max-sm:hidden lg:col-start-2 lg:row-start-2">
          {showPhone ? (
            <PhoneHandoff qrSvg={qrSvg} url={phoneUrl} code={code} />
          ) : (
            <Button variant="tertiary" size="sm" onClick={() => setPhoneOpen(true)}>
              Use your phone&rsquo;s camera instead
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

/** The reminder with its code in mono, and a hyphenated label (X-VESOLJE) never broken at its hyphen. */
const DENIED: Record<Platform, string> = {
  ios: "In Safari, tap aA in the address bar, then Website Settings, and set Camera to Allow.",
  android: "In Chrome, tap the settings icon left of the address bar, then Permissions, and turn on Camera.",
  other: "Allow the camera for this site from the address bar, then try again.",
};

/** A phone with no camera: a laptop is no way on there, another phone is (behind "Use another phone"). */
const NO_CAMERA_PHONE = "Photos can only come from a live camera, never a file. Use another phone with a camera.";

const MESSAGES: Record<Exclude<CameraState, "live"> | "expired", { title: string; body: string; retry?: boolean }> = {
  starting: { title: "Waiting for the camera", body: "Your browser will ask to use it. Choose Allow." },
  denied: { title: "Camera is off for this site", body: DENIED.other, retry: true },
  nocamera: { title: "No camera found", body: "Photos can only come from a live camera, never a file. Use a phone or a laptop with a camera." },
  insecure: { title: "The camera needs a secure page", body: "Browsers only open the camera over https. Open this page’s https address, or use your phone." },
  error: { title: "The camera didn’t start", body: "Another app may be using it. Close that app, then try again.", retry: true },
  expired: { title: "Your 10 minutes are up", body: "Your refund is still waiting. Get a new code, write it on a fresh piece of paper, and take the photo within 10 minutes." },
};

/**
 * Inside the frame, left-aligned: what's wrong, how to fix it, and one action.
 * A phone whose camera won't open can carry the claim to another phone.
 */
function FrameMessage({
  camera,
  platform,
  device,
  phone,
  left,
  handoff,
  collapsed,
  onBack,
  onRetry,
}: {
  camera: Exclude<CameraState, "live"> | "expired";
  platform: Platform;
  /** "your phone" or "this computer": where the photos are taken, and stay until they're sent. */
  device: string;
  /** A touch phone: a phone with no camera is told to use another phone, not "a phone or a laptop". */
  phone?: boolean;
  /** The code's time left: a camera to fix in the settings, or another app to close, runs it down meanwhile. */
  left: number;
  /** A phone: this claim's QR and link, for another phone, behind "Use another phone". */
  handoff?: ReactNode;
  /** A laptop's frame has given up its 4:3 box: the message sets the height. */
  collapsed?: boolean;
  /** The camera won't open: the way back to the code and its timer. */
  onBack?(): void;
  onRetry(): void;
}) {
  const m = MESSAGES[camera];
  const [another, setAnother] = useState(false);
  return (
    <div
      role={camera === "starting" ? "status" : "alert"}
      className={clsx("absolute inset-0 flex flex-col justify-center gap-2 overflow-y-auto p-5 text-left sm:p-6", collapsed && "sm:relative sm:inset-auto sm:min-h-56")}
    >
      {/* Why the camera won't open is the step's heading then: the instruction strip steps aside. */}
      {camera === "starting" || camera === "expired" ? (
        <p className="text-body font-medium text-text">{m.title}</p>
      ) : (
        <h1 id="camera-message" tabIndex={-1} className="text-body font-medium text-text outline-none">
          {m.title}
        </h1>
      )}
      <p className="max-w-[30rem] text-ui text-pretty text-muted">
        {camera === "denied" ? DENIED[platform] : camera === "starting" ? `${m.body} Only the photos you send leave ${device}.` : camera === "nocamera" && phone ? NO_CAMERA_PHONE : m.body}
      </p>
      {/* The code's clock runs on while the camera is fixed, or while another device is found. */}
      {(m.retry || camera === "nocamera") && (
        <p className="text-ui text-muted">
          Your code&rsquo;s timer keeps running:{" "}
          <span role="timer" aria-live="off">
            <span className="font-mono">{mmss(left)}</span> left
          </span>
          .
        </p>
      )}
      {(m.retry || handoff || onBack) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-3">
          {m.retry && <Button onClick={onRetry}>Try again</Button>}
          {handoff && !another && (
            <Button variant="secondary" onClick={() => setAnother(true)}>
              Use another phone
            </Button>
          )}
          {onBack && (
            // Below 1024px the camera's top bar has it already. A button, so it looks like one: the quiet kind.
            <Button variant="secondary" onClick={onBack} className="max-lg:hidden">
              Back to your code
            </Button>
          )}
        </div>
      )}
      {another && handoff && <div className="mt-3">{handoff}</div>}
    </div>
  );
}
