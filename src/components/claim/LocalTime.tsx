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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const two = (n: number) => String(n).padStart(2, "0");

/** "Today", "Yesterday" or "7 Nov", in the viewer's own zone. */
function dayWord(d: Date): string {
  const at = (x: Date) => x.toDateString();
  const now = new Date();
  if (at(d) === at(now)) return "Today";
  if (at(d) === at(new Date(now.getTime() - 86_400_000))) return "Yesterday";
  return `${d.getDate()} ${MONTHS[d.getMonth()]},`;
}

/**
 * A claim's time in the viewer's own zone once the page has hydrated ("14:32", "7 Nov 2026, 14:32"); on the server and
 * through hydration the UTC stamp the console prints, so the two never mismatch. The UTC stamp stays in the title.
 */
export function ClaimTime({ iso, format }: { iso: string; format: "clock" | "day" | "stamp" }) {
  const local = useLocal();
  const d = new Date(iso);
  const hm = `${two(d.getHours())}:${two(d.getMinutes())}`;
  const text = local
    ? format === "clock"
      ? hm
      : format === "day"
        ? `${dayWord(d)} ${hm}`
        : `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hm}`
    : format === "stamp"
      ? stamp(iso)
      : `${clock(iso).slice(0, 5)} UTC`;
  // A stamp breaks only after its comma, so on a narrow receipt the date and the time each stay whole.
  return (
    <time dateTime={iso} title={stamp(iso)} suppressHydrationWarning>
      {text.split(", ").map(nbsp).join(", ")}
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
