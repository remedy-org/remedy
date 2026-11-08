"use client";

import clsx from "clsx";
import dynamic from "next/dynamic";
import { useState } from "react";
import type { ClaimsGridPreviewProps } from "./ClaimsGridPreview";

const Preview = dynamic(() => import("./ClaimsGridPreview").then((m) => m.ClaimsGridPreview), { ssr: false });

/**
 * The sign-in page's picture of the console: the real claims grid on the shared recall, flat and at 1:1, running off the
 * right edge. Inert, and out of the accessibility tree: the form beside it says what it is in words. It fades in once
 * the grid has drawn, over an empty frame of the same size, so nothing moves.
 */
export function SigninPreview(props: ClaimsGridPreviewProps) {
  const [ready, setReady] = useState(false);
  return (
    // The frame's height is known before the grid's script loads (chrome, heading, ledger, tabs, grid, footer), so the
    // form beside it never moves.
    <div aria-hidden="true" inert className="relative w-[1120px]" style={{ minHeight: props.height + 224 }}>
      <div className={clsx("absolute inset-0 rounded-frame bg-bg shadow-card transition-opacity duration-500 ease-out", ready && "opacity-0")} />
      <div className={clsx("relative transition-opacity duration-500 ease-out", ready ? "opacity-100" : "opacity-0")}>
        <Preview {...props} className="shadow-card" onReady={() => setReady(true)} />
      </div>
    </div>
  );
}
