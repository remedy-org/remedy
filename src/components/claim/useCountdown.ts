"use client";

import { useEffect, useState } from "react";

/**
 * Milliseconds left until `expiresAt`, ticking each second. `startNow` is the server's clock at render, so the first
 * paint matches on server and client; `frozen` keeps it there (previews and screenshots).
 */
export function useCountdown(expiresAt: string, startNow: number, frozen = false): number {
  const end = Date.parse(expiresAt);
  const [now, setNow] = useState(startNow);
  useEffect(() => {
    if (frozen) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [frozen]);
  return Math.max(0, end - now);
}

export function mmss(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
