"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { photoWidth } from "./Exhibit";

// A photo's shape, remembered for this page's life: the camera knows it as it takes the photo, so the checking screen
// and the result after it draw the photo at its own size from the first frame, and nothing reflows when it loads.
const aspects = new Map<string, number>();
// Portrait as tall as 2:3 and landscape as wide as 4:3 show whole and edge to edge; anything beyond keeps a thin band.
const clampAspect = (r: number) => Math.min(4 / 3, Math.max(2 / 3, r));

/** The camera (or a demo photo) records a photo's size as it's taken: claim id and photo number (1-based). */
export function rememberAspect(claimId: string, n: number, width: number, height: number) {
  if (width > 0 && height > 0) aspects.set(`${claimId}:${n}`, clampAspect(width / height));
}

/**
 * A claim's photos as evidence, the same element from the checking screen to the result: the photo being looked at whole,
 * at its own shape (never cropped, never in a frame of empty bands), and, when there are several, every photo as an equal
 * thumbnail under it, the one shown outlined.
 */
export function ClaimPhotos({ urls, claimId }: { urls: string[]; claimId: string }) {
  const [active, setActive] = useState(0);
  const [aspect, setAspect] = useState(() => aspects.get(`${claimId}:1`) ?? 4 / 5);
  const img = useRef<HTMLImageElement>(null);
  const measure = (el: HTMLImageElement | null, n: number) => {
    if (!el?.naturalWidth) return;
    rememberAspect(claimId, n, el.naturalWidth, el.naturalHeight);
    setAspect(aspects.get(`${claimId}:${n}`)!);
  };
  // Already decoded (from the cache) before this ran: onLoad has come and gone.
  useEffect(() => {
    if (img.current?.complete) measure(img.current, active + 1);
    // Only when the shown photo changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!urls.length) {
    return <div className="flex aspect-[4/3] w-full items-center justify-center rounded-card border border-dashed border-line-strong text-ui text-faint">Your photos are on their way</div>;
  }
  const show = (i: number) => {
    const known = aspects.get(`${claimId}:${i + 1}`);
    if (known) setAspect(known);
    setActive(i);
  };
  return (
    <div className="flex flex-col gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={img}
        key={urls[active]}
        src={urls[active]}
        alt={`Photo ${active + 1} of claim ${claimId}`}
        onLoad={(e) => measure(e.currentTarget, active + 1)}
        style={{ aspectRatio: aspect, width: photoWidth(aspect) }}
        className="block h-auto rounded-card bg-surface-2 object-contain ring-1 ring-line"
      />
      {urls.length > 1 && (
        <ul aria-label={`${urls.length} photos`} className="flex gap-2">
          {urls.map((src, i) => (
            <li key={`${src}-${i}`}>
              <button
                type="button"
                onClick={() => show(i)}
                aria-pressed={i === active}
                aria-label={`Show photo ${i + 1}`}
                className={clsx(
                  "block size-14 overflow-hidden rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                  i === active ? "ring-2 ring-text" : "ring-1 ring-line opacity-70 hover:opacity-100",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="size-full bg-surface-2 object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
