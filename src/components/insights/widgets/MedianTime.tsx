"use client";

import type { AgWidgetParams } from "ag-studio";
import { duration, median } from "@/app/console/_lib/view";
import type { MedianTimeDef } from "./defs";
import { spokenTime } from "../report";
import { useRows } from "./useRows";

// Custom widget 5: a median duration as a KPI tile, "0:03" as the console's ledger prints it. Studio's value tile can
// only average (its median measure returns nothing without a grouping), and one claim a person approved an hour later
// drags an average of three-second payouts to minutes. The median is the ledger's own (view.ts), over one time per
// claim, so filters and cross-filters apply and the two pages always agree.

// With no time among the claims on the page (a cross-filter on refused claims), the tile shows a dash in its value's
// place, not Studio's centred "No data" overlay under a left-aligned title.
export function MedianTime(params: AgWidgetParams<MedianTimeDef> & { spoken?: boolean }) {
  const { dataMapping, widgetApi } = params;
  const per = dataMapping.per?.[0];
  const seconds = dataMapping.seconds?.[0];
  const rows = useRows(widgetApi, () => (per && seconds ? [{ fields: [per, seconds] }] : null), [params], "displayed");
  if (!rows || !per || !seconds) return null;

  const mid = median((rows[0] ?? []).flatMap((r) => (typeof r[seconds.key] === "number" ? [r[seconds.key] as number] : [])));
  const say = params.spoken ? spokenTime : duration;
  return <p className="px-2 pt-1 text-[28px] leading-none text-text">{mid === null ? "—" : say(Math.round(mid))}</p>;
}

/** The homepage's tile: "12 sec", as the homepage says a time. */
export const HomeMedianTime = (params: AgWidgetParams<MedianTimeDef>) => <MedianTime {...params} spoken />;
