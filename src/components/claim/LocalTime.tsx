"use client";

import { useSyncExternalStore } from "react";
import { clock, stamp } from "./model";

const noop = () => () => {};
const nbsp = (s: string) => s.replace(/ /g, "\u00a0");

/**
 * A claim's time in the viewer's own time zone ("20:15:02 GMT+5:30", "7 Nov, 20:15 GMT+5:30"). The server, and
 * the first paint before hydration, print UTC (clock, stamp), so the two never mismatch.
 */
export function LocalTime({ iso, format }: { iso: string; format: "clock" | "stamp" }) {
  const local = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const d = new Date(iso);
  const time = (o: Intl.DateTimeFormatOptions) => d.toLocaleTimeString("en-GB", { ...o, hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "short" });
  // A stamp breaks only after its comma, never between the time and its zone; this year's date drops the year, so on a
  // narrow receipt "7 Nov, 20:02 GMT+5:30" fits one line.
  const date = () => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(d.getFullYear() === new Date().getFullYear() ? {} : { year: "numeric" }) });
  const text = !local
    ? format === "clock"
      ? `${clock(iso)} UTC`
      : stamp(iso)
    : format === "clock"
      ? time({ second: "2-digit" })
      : `${nbsp(date())}, ${nbsp(time({}))}`;
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {text}
    </time>
  );
}
