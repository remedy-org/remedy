"use client";

import clsx from "clsx";
import { useState } from "react";
import { AlertIcon } from "@/components/ui";

/** The photo route URL at a width (console/_lib/photos.ts): resized and cached on the server. */
export const atWidth = (src: string, w: 96 | 240 | 880) => `${src}${src.includes("?") ? "&" : "?"}w=${w}`;

/**
 * One claim photo from the private photo route, at 880px (the panel at 2x); the link opens it full size. Loads over a
 * skeleton tint and fades in (which is also the cross-fade when the panel follows ↑/↓); a failed load says so in place.
 * A sample photo carries its label on the photo itself. sized: src is already the size to show (the homepage preview).
 */
export function EvidencePhoto({ src, n, of, sample, sized, className }: { src: string; n: number; of: number; sample?: boolean; sized?: boolean; className?: string }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const label = `Photo ${n} of ${of}`;
  return (
    <figure className={clsx("flex flex-col gap-2", className)}>
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        className={clsx(
          "relative block aspect-[4/3] overflow-hidden rounded-control border border-line bg-surface-2",
          state === "loading" && "animate-[skeleton-pulse_1.6s_ease-in-out_infinite]",
        )}
        aria-label={`${label}${sample ? ", an AI-made test photo" : ""}, opens full size`}
      >
        {state === "error" ? (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-ui text-muted">
            <AlertIcon className="text-stop" />
            Photo didn&apos;t load. Open it full size, or reload the panel.
          </span>
        ) : (
          // A private, session-checked route: next/image's optimizer can't fetch it with the company's cookie.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sized ? src : atWidth(src, 880)}
            alt={label}
            onLoad={() => setState("ready")}
            onError={() => setState("error")}
            className={clsx("size-full object-cover transition-opacity duration-120 ease-snap", state === "ready" ? "opacity-100" : "opacity-0")}
          />
        )}
        {sample && state !== "error" && (
          <span className="micro absolute inset-x-0 bottom-0 bg-[oklch(0.165_0.012_255/0.78)] px-2 py-1 text-[oklch(0.96_0.005_255)]">AI-made test photo</span>
        )}
      </a>
      <figcaption className="font-mono text-micro text-muted">{label}</figcaption>
    </figure>
  );
}
