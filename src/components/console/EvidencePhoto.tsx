"use client";

import clsx from "clsx";
import { useState } from "react";
import { AlertIcon } from "@/components/ui";

/** One claim photo from the private photo route. Loads over a skeleton tint; a failed load says so in place. */
export function EvidencePhoto({ src, n, of, className }: { src: string; n: number; of: number; className?: string }) {
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
        aria-label={`${label}, opens full size`}
      >
        {state === "error" ? (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-ui text-muted">
            <AlertIcon className="text-stop" />
            Photo didn&apos;t load. Open it full size, or reload the drawer.
          </span>
        ) : (
          // A private, session-checked route: next/image's optimizer can't fetch it with the company's cookie.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={label}
            onLoad={() => setState("ready")}
            onError={() => setState("error")}
            className={clsx("size-full object-cover transition-opacity duration-160", state === "ready" ? "opacity-100" : "opacity-0")}
          />
        )}
      </a>
      <figcaption className="font-mono text-micro text-muted">{label}</figcaption>
    </figure>
  );
}
