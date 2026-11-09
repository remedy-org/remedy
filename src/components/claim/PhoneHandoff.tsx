"use client";

import clsx from "clsx";
import { useState } from "react";
import { Button } from "@/components/ui";

export interface PhoneHandoffProps {
  /** QR code as an SVG string, made on the server (qrcode). */
  qrSvg: string;
  url: string;
  code: string;
  /** The code step on a laptop: the phone is the camera to use, so its QR is the step's lead. */
  primary?: boolean;
  className?: string;
}

/** "remedy-recalls.vercel.app/…/claim/RM-1234": the host and the claim, the path between them elided. */
const shortUrl = (url: string) => {
  const { host, pathname } = new URL(url);
  const parts = pathname.split("/").filter(Boolean);
  return parts.length > 2 ? `${host}/…/${parts.slice(-2).join("/")}` : `${host}${pathname}`;
};

/** Continue the same claim on a phone: same code, same timer, same PayPal account. */
export function PhoneHandoff({ qrSvg, url, code, primary, className }: PhoneHandoffProps) {
  const [copied, setCopied] = useState<"yes" | "no" | null>(null);
  const copy = () =>
    navigator.clipboard?.writeText(url).then(
      () => setCopied("yes"),
      () => setCopied("no"),
    ) ?? setCopied("no");
  const said = copied === "yes" ? "Link copied" : copied === "no" ? "Couldn’t copy. The link is above." : "";
  return (
    // On the page, not in a box of its own: the code on the cream paper the tag is on, so it's the same object, not a
    // second bright slab. Ink on paper reads in any phone camera, in either theme.
    <div className={clsx("flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5", className)}>
      <div
        className={clsx("shrink-0 rounded-control bg-paper ring-1 ring-paper-line [&>svg]:size-full", primary ? "size-36 p-3" : "size-32 p-2.5")}
        dangerouslySetInnerHTML={{ __html: qrSvg }}
        role="img"
        aria-label="QR code for this claim"
      />
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="text-ui font-medium text-text">
          {primary ? "Take the photo on your phone" : "Continue on your phone"}
        </p>
        <p className="text-ui text-muted">
          Scan it with the phone&rsquo;s camera and log in with the same PayPal account. Your code stays <span className="font-mono text-text">{code}</span>.
        </p>
        {/* The link on one line, its middle elided so it never breaks mid-word: Copy link carries the whole of it. Named for
            what it is, so a screen reader doesn't spell out the address. */}
        <a href={url} aria-label="Open this claim on your phone" className="truncate font-mono text-micro whitespace-nowrap text-faint underline decoration-line-2 underline-offset-4 hover:text-muted">
          {shortUrl(url)}
        </a>
        <Button variant="secondary" size="sm" onClick={copy} className="self-start">
          {copied === "yes" ? "Link copied" : "Copy link"}
        </Button>
        {copied === "no" && <p className="text-ui text-muted">{said}</p>}
        <span className="sr-only" aria-live="polite">
          {said}
        </span>
      </div>
    </div>
  );
}
