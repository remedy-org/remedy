"use client";

import clsx from "clsx";
import { useState } from "react";
import { Button } from "@/components/ui";
import { PhoneIcon } from "./icons";

export interface PhoneHandoffProps {
  /** QR code as an SVG string, made on the server (qrcode). */
  qrSvg: string;
  url: string;
  code: string;
  /** The code step on a laptop: the phone is the recommended camera, so the QR is 160px and leads. */
  primary?: boolean;
  className?: string;
}

/** Continue the same claim on a phone: same code, same timer, same PayPal account. */
export function PhoneHandoff({ qrSvg, url, code, primary, className }: PhoneHandoffProps) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={clsx("flex flex-col gap-4 rounded-card border border-line p-4", primary ? "bg-surface-2/60 sm:flex-row sm:items-center sm:gap-6 sm:p-5 lg:flex-col lg:items-stretch lg:gap-4" : "sm:flex-row sm:items-center", className)}>
      {/* A white plate so any phone camera reads it, in either theme. */}
      <div
        className={clsx("shrink-0 self-center rounded-control bg-[oklch(1_0_0)] [&>svg]:size-full", primary ? "size-40 p-3 lg:self-start" : "size-32 p-2.5")}
        dangerouslySetInnerHTML={{ __html: qrSvg }}
        role="img"
        aria-label="QR code for this claim"
      />
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="flex items-center gap-2 text-ui font-medium text-text">
          <PhoneIcon className="shrink-0 text-muted" />
          {primary ? "Take the photo on your phone" : "Continue on your phone"}
        </p>
        <p className="text-ui text-muted">
          {primary ? (
            <>
              Scan it with your phone&apos;s camera and log in with the same PayPal account. Same code, <span className="font-mono text-text">{code}</span>, same timer.
            </>
          ) : (
            <>
              Scan this with the phone&apos;s camera and log in with the same PayPal account. Your code stays <span className="font-mono text-text">{code}</span> and the timer keeps running.
            </>
          )}
        </p>
        {/* The whole link, wrapping, to type into a phone or send to it. */}
        <a href={url} className="font-mono text-micro break-all text-faint underline decoration-line-2 underline-offset-4 hover:text-muted">
          {url.replace(/^https?:\/\//, "")}
        </a>
        <Button variant="tertiary" size="sm" onClick={() => navigator.clipboard?.writeText(url).then(() => setCopied(true), () => {})} className="self-start">
          {copied ? "Link copied" : "Copy link"}
        </Button>
        <span className="sr-only" aria-live="polite">
          {copied ? "Link copied" : ""}
        </span>
      </div>
    </div>
  );
}
