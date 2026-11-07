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
 * A claim's time as the company's console prints it, in UTC and saying so, so the owner's receipt and the console name
 * one moment the same way: "14:32 UTC" (clock), "7 Nov 2026, 14:32 UTC" (stamp).
 */
export function ClaimTime({ iso, format }: { iso: string; format: "clock" | "stamp" }) {
  // A stamp breaks only after its comma, so on a narrow receipt the date and the time each stay whole.
  return <time dateTime={iso}>{format === "clock" ? nbsp(`${clock(iso).slice(0, 5)} UTC`) : stamp(iso).split(", ").map(nbsp).join(", ")}</time>;
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
