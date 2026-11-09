"use client";

import clsx from "clsx";
import { useId, useState } from "react";
import { AlertIcon } from "@/components/ui";

/** The photo route URL at a width (console/_lib/photos.ts): resized and cached on the server. */
export const atWidth = (src: string, w: 96 | 240 | 880) => `${src}${src.includes("?") ? "&" : "?"}w=${w}`;

/** The photo itself at full size: a sized src through Next's image optimizer (the homepage) names the original. */
const fullSize = (src: string) => (src.startsWith("/_next/image?") ? (new URLSearchParams(src.slice(src.indexOf("?") + 1)).get("url") ?? src) : src);

/**
 * One claim photo from the private photo route, at 880px (the panel at 2x). With onOpen (the console) it's a button
 * that opens the in-app viewer, and shows the whole photo, uncropped; tall is a portrait frame for two side by side,
 * filled edge to edge (the viewer has it whole). Without onOpen, a link that opens it full size. Loads over a
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
  description,
  plain,
  className,
  captionClassName,
}: {
  src: string;
  /** What the photo check saw (and the code it read): told to a screen reader with the photo. */
  description?: string;
  n: number;
  of: number;
  sized?: boolean;
  tall?: boolean;
  onOpen?: () => void;
  /** The photo alone, opening nothing (the homepage, where it is already shown large). */
  plain?: boolean;
  className?: string;
  /** The caption's size and colour, when not the console's (the homepage sets its own). */
  captionClassName?: string;
}) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const label = `Photo ${n} of ${of}`;
  const descId = useId();
  const describedBy = description ? descId : undefined;
  const frame = clsx(
    "relative block w-full overflow-hidden rounded-control border border-line bg-surface-2",
    tall ? "aspect-[3/4]" : "aspect-[4/3]",
    // A short window: the photo stays within 45% of its height, so it is seen whole beside the panel's header and footer.
    "[@media(max-height:600px)]:max-h-[45vh]",
    state === "loading" && "animate-[skeleton-pulse_1.6s_ease-in-out_infinite]",
  );
  const inner = (
    <>
      {state === "error" ? (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-ui text-muted">
          <AlertIcon className="text-stop" />
          Photo didn&rsquo;t load. {onOpen ? "Open the viewer" : "Open it full size"}, or reload the panel.
        </span>
      ) : (
        // A private, session-checked route: next/image's optimizer can't fetch it with the company's cookie.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sized ? src : atWidth(src, 880)}
          alt={description ? `${label}. ${description}` : label}
          // A photo that finished loading before hydration fired its load event too early for onLoad to see it.
          ref={(img) => {
            if (img?.complete && img.naturalWidth) setState("ready");
          }}
          onLoad={() => setState("ready")}
          onError={() => setState("error")}
          // A tall frame (a repost's pair) is filled edge to edge, never letterboxed in grey: the viewer shows it whole.
          className={clsx("size-full transition-opacity duration-120 ease-snap", onOpen && !tall ? "object-contain" : "object-cover", state === "ready" ? "opacity-100" : "opacity-0")}
        />
      )}
    </>
  );
  return (
    <figure className={clsx("flex flex-col gap-2", className)}>
      {onOpen ? (
        <button type="button" onClick={onOpen} className={clsx(frame, "cursor-zoom-in")} aria-label={`${label}, opens the photo viewer`} aria-describedby={describedBy}>
          {inner}
        </button>
      ) : plain ? (
        <span className={frame}>{inner}</span>
      ) : (
        <a href={fullSize(src)} target="_blank" rel="noreferrer" className={frame} aria-label={`${label}, opens full size (opens in a new tab)`} aria-describedby={describedBy}>
          {inner}
        </a>
      )}
      <figcaption className={captionClassName ?? "text-micro text-muted"}>{label}</figcaption>
      {description && (
        <span id={descId} className="sr-only">
          {description}
        </span>
      )}
    </figure>
  );
}
