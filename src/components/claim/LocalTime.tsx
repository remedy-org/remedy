"use client";

import { useSyncExternalStore } from "react";
import { clock, resetWords, stamp } from "./model";

const noop = () => () => {};
const nbsp = (s: string) => s.replace(/ /g, " ");
// False on the server and through hydration, true after: the client's own time zone is only known there.
const useLocal = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

/**
 * A claim's time in the viewer's own time zone, to the minute and with no zone label, since it's their own: "20:15"
 * (another day: "6 Nov, 20:15"), "7 Nov, 20:15". The server, and the first paint before hydration, print UTC (clock,
 * stamp), so the two never mismatch.
 */
export function LocalTime({ iso, format }: { iso: string; format: "clock" | "stamp" }) {
  const local = useLocal();
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  // A stamp breaks only after its comma; this year's date drops the year, so on a narrow receipt "7 Nov, 20:02" fits one line.
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }) });
  const today = d.toDateString() === now.toDateString();
  const text = !local ? (format === "clock" ? `${clock(iso).slice(0, 5)} UTC` : stamp(iso)) : format === "clock" && today ? time : `${nbsp(date)}, ${time}`;
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {text}
    </time>
  );
}

/**
 * When a daily limit resets, in the viewer's time: `${prefix}05:30 tomorrow`. Until hydration (and on the server, which
 * doesn't know the viewer's zone) the zone-free `fallback`, such as "in about 6 hours".
 */
export function ResetTime({ until, prefix, fallback }: { until: string; prefix: string; fallback: string }) {
  const local = useLocal();
  return (
    <time dateTime={until} suppressHydrationWarning>
      {local ? `${prefix}${resetWords(new Date(until), new Date())}` : fallback}
    </time>
  );
}
