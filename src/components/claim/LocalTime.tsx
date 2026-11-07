"use client";

import { useSyncExternalStore } from "react";
import { clock, stamp } from "./model";

const noop = () => () => {};

/**
 * A claim's time in the viewer's own time zone ("20:15:02 GMT+5:30", "7 Nov 2026, 20:15 GMT+5:30"). The server, and
 * the first paint before hydration, print UTC (clock, stamp), so the two never mismatch.
 */
export function LocalTime({ iso, format }: { iso: string; format: "clock" | "stamp" }) {
  const local = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const d = new Date(iso);
  const text = !local
    ? format === "clock"
      ? `${clock(iso)} UTC`
      : stamp(iso)
    : d.toLocaleString("en-GB", {
        ...(format === "stamp" ? { day: "numeric", month: "short", year: "numeric" } : { second: "2-digit" }),
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZoneName: "short",
      });
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {text}
    </time>
  );
}
