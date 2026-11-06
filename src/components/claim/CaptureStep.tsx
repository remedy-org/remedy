"use client";

import clsx from "clsx";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { AlertIcon, Button, Card, CrossIcon, ErrorState } from "@/components/ui";
import { CameraIcon } from "./icons";
import type { ClaimView } from "./model";
import { PhoneHandoff } from "./PhoneHandoff";
import { mmss, useCountdown } from "./useCountdown";

export type CameraState = "starting" | "live" | "denied" | "nocamera" | "insecure" | "error";

// Long side in px after downscaling. Three photos stay far under Vercel's 4.5 MB body limit.
const MAX_SIDE = 1600;
const QUALITY = 0.85;
const MAX_PHOTOS = 3;
const MAX_BYTES = 4.4 * 1024 * 1024;

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
  /** The pre-checks' answer; null when the photos had already arrived (another tab). */
  onSent(view: ClaimView | null): void;
  /** Dev previews and screenshots: no camera, a fixed state. */
  preview?: CapturePreview;
}

const subscribeCoarse = (cb: () => void) => {
  const mq = window.matchMedia("(pointer: coarse)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** Live camera only: no upload control. Up to 3 shots, downscaled in the browser, sent with the session id. */
export function CaptureStep({ claimId, sessionId, code, expiresAt, startNow, qrSvg, phoneUrl, newClaimHref, loginHref, onSent, preview }: CaptureStepProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camera, setCamera] = useState<CameraState>(preview?.camera ?? "starting");
  const [attempt, setAttempt] = useState(0);
  const [shots, setShots] = useState<Shot[]>(() => (preview?.shots ?? []).map((url) => ({ url, blob: null })));
  const [sending, setSending] = useState(preview?.sending ?? false);
  const [sendError, setSendError] = useState<{ status: number; message: string } | null>(preview?.sendError ? { status: 500, message: preview.sendError } : null);
  const [flash, setFlash] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(preview?.showPhone ?? false);
  const coarse = useSyncExternalStore(subscribeCoarse, () => window.matchMedia("(pointer: coarse)").matches, () => false);
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
    setFlash(true);
    setTimeout(() => setFlash(false), 160);
  }

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
      onSent(body as ClaimView);
    } catch {
      setSendError({ status: 0, message: "No connection. Your photos are still here: send them again when you're back online." });
      setSending(false);
    }
  }

  const live = camera === "live" && !expired;
  const n = shots.length;
  const showPhone = !coarse && (phoneOpen || (!expired && (camera === "denied" || camera === "nocamera" || camera === "insecure")));

  return (
    <Card padding="none" as="section" aria-labelledby="capture-title" className="overflow-hidden">
      {/* The viewfinder is dark in both themes, like a camera's. */}
      <div data-theme="dark" className="relative aspect-[3/4] bg-[oklch(0.12_0.01_255)] text-text sm:aspect-[4/3]">
        <video ref={videoRef} playsInline muted aria-label="Camera preview" className={clsx("absolute inset-0 size-full object-cover", !live && "invisible")} />
        {preview?.still && live && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview.still} alt="" className="absolute inset-0 size-full object-cover" />
        )}
        {live && <Guides />}

        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3">
          <Chip>
            Code <span className="text-text">{code}</span>
          </Chip>
          <Chip>
            <span role="timer" aria-live="off" className={clsx(left < 60_000 && !expired && "text-accent-text")}>
              {expired ? "Ended" : mmss(left)}
            </span>
          </Chip>
        </div>

        {!live && (
          <FrameMessage
            camera={expired || camera === "live" ? "expired" : camera}
            onRetry={() => {
              setCamera("starting");
              setAttempt((a) => a + 1);
            }}
          />
        )}
        <div aria-hidden="true" className={clsx("pointer-events-none absolute inset-0 bg-[oklch(1_0_0)] transition-opacity duration-160", flash ? "opacity-60" : "opacity-0")} />
      </div>

      <div className="flex flex-col gap-5 p-6">
        <h2 id="capture-title" className="text-body font-medium text-text">
          Fit the label, the destroyed product and the code <span className="font-mono">{code}</span> in the frame
        </h2>

        <div className="flex items-center gap-4">
        <ul className="flex gap-2" aria-label={`${n} of ${MAX_PHOTOS} photos taken`}>
          {Array.from({ length: MAX_PHOTOS }, (_, i) => (
            <li key={i} className="relative size-16 shrink-0">
              {shots[i] ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={shots[i].url} alt={`Photo ${i + 1}`} className="size-full rounded-control border border-line object-cover" />
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    disabled={sending}
                    aria-label={`Remove photo ${i + 1}`}
                    className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-[oklch(0.12_0.01_255/0.8)] text-[oklch(0.96_0.005_255)] after:absolute after:-inset-2 after:content-[''] disabled:opacity-40"
                  >
                    <CrossIcon size={12} />
                  </button>
                </>
              ) : (
                <span className="flex size-full items-center justify-center rounded-control border border-dashed border-line-strong font-mono text-ui text-faint">{i + 1}</span>
              )}
            </li>
          ))}
        </ul>
          <p className="font-mono text-ui whitespace-nowrap text-faint tabular-nums">
            {n === 0 ? "Up to 3 photos" : `${n} of ${MAX_PHOTOS} taken`}
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
          <div className={clsx("grid gap-3", n > 0 && n < MAX_PHOTOS && "sm:grid-cols-2")}>
            {n < MAX_PHOTOS && (
              <Button size="lg" block variant={n === 0 ? "primary" : "secondary"} onClick={capture} disabled={!live || sending}>
                <span className="inline-flex items-center gap-2">
                  <CameraIcon />
                  {n === 0 ? "Take photo" : "Take another"}
                </span>
              </Button>
            )}
            {n > 0 && (
              <Button size="lg" block onClick={send} pending={sending} pendingLabel={`Sending ${n === 1 ? "photo" : `${n} photos`}…`}>
                Send {n === 1 ? "photo" : `${n} photos`}
              </Button>
            )}
          </div>
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
      </div>
    </Card>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="inline-flex h-7 items-center gap-1.5 rounded-control bg-[oklch(0.12_0.01_255/0.72)] px-2.5 font-mono text-ui text-muted tabular-nums backdrop-blur-sm">{children}</span>;
}

// Corner marks: where to keep the product, without covering it.
function Guides() {
  const corner = "absolute size-6 border-[oklch(1_0_0/0.7)]";
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-12 sm:inset-x-20 sm:inset-y-14">
      <span className={clsx(corner, "top-0 left-0 rounded-tl-control border-t-2 border-l-2")} />
      <span className={clsx(corner, "top-0 right-0 rounded-tr-control border-t-2 border-r-2")} />
      <span className={clsx(corner, "bottom-0 left-0 rounded-bl-control border-b-2 border-l-2")} />
      <span className={clsx(corner, "right-0 bottom-0 rounded-br-control border-r-2 border-b-2")} />
    </div>
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
    <div role={camera === "starting" ? "status" : "alert"} className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
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
