"use client";

import clsx from "clsx";
import { useState } from "react";
import { AlertIcon } from "@/components/ui";

/** The photo route URL at a width (console/_lib/photos.ts): resized and cached on the server. */
export const atWidth = (src: string, w: 96 | 240 | 880) => `${src}${src.includes("?") ? "&" : "?"}w=${w}`;

/**
 * One claim photo from the private photo route, at 880px (the panel at 2x). With onOpen (the console) it's a button
 * that opens the in-app viewer, and shows the whole photo, uncropped (tall: a portrait frame, for two side by side);
 * without, a link that opens it full size. Loads over a
 * skeleton tint and fades in (which is also the cross-fade when the panel follows ↑/↓); a failed load says so in place.
 * sized: src is already the size to show (the homepage preview).
 */
export function EvidencePhoto({
  src,
  n,
  of,
  sized,
  tall,
  onOpen,
  className,
}: {
  src: string;
  n: number;
  of: number;
  sized?: boolean;
  tall?: boolean;
  onOpen?: () => void;
  className?: string;
}) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const label = `Photo ${n} of ${of}`;
  const frame = clsx(
    "relative block w-full overflow-hidden rounded-control border border-line bg-surface-2",
    tall ? "aspect-[3/4]" : "aspect-[4/3]",
    state === "loading" && "animate-[skeleton-pulse_1.6s_ease-in-out_infinite]",
  );
  const inner = (
    <>
      {state === "error" ? (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-ui text-muted">
          <AlertIcon className="text-stop" />
          Photo didn&apos;t load. {onOpen ? "Open the viewer" : "Open it full size"}, or reload the panel.
        </span>
      ) : (
        // A private, session-checked route: next/image's optimizer can't fetch it with the company's cookie.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sized ? src : atWidth(src, 880)}
          alt={label}
          onLoad={() => setState("ready")}
          onError={() => setState("error")}
          className={clsx("size-full transition-opacity duration-120 ease-snap", onOpen ? "object-contain" : "object-cover", state === "ready" ? "opacity-100" : "opacity-0")}
        />
      )}
    </>
  );
  return (
    <figure className={clsx("flex flex-col gap-2", className)}>
      {onOpen ? (
        <button type="button" onClick={onOpen} className={clsx(frame, "cursor-zoom-in")} aria-label={`${label}, opens the photo viewer`}>
          {inner}
        </button>
      ) : (
        <a href={src} target="_blank" rel="noreferrer" className={frame} aria-label={`${label}, opens full size`}>
          {inner}
        </a>
      )}
      <figcaption className="text-micro text-muted">{label}</figcaption>
    </figure>
  );
}
