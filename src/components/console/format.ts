// Display formats shared by the console's server and client components, in the claim flow's order ("5 Nov 2026").
// Times are in UTC and say so, like the receipt's "7 Nov 2026, 14:32 UTC"; dates (CPSC's recall date) are calendar
// dates with no zone.

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** "2026-11-05" -> "5 Nov 2026". */
export const formatDate = (isoDate: string) => dateFmt.format(new Date(`${isoDate.slice(0, 10)}T00:00:00Z`));

const etFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "America/New_York" });

/** The day a moment fell on in US Eastern time, CPSC's zone: "6 Nov 2026". The report labels it "(ET)", so server
 * and viewer agree whatever their own zones. */
export const formatDayET = (iso: string) => etFmt.format(new Date(iso));

const timeFmt = new Intl.DateTimeFormat("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC", timeZoneName: "short" });

/** "7 Nov, 14:02 UTC". */
export const formatTime = (iso: string) => timeFmt.format(new Date(iso));

/** "14:02:05", in UTC like formatTime, beside which it is shown. */
const clockFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZone: "UTC" });
export const formatClock = (iso: string) => clockFmt.format(new Date(iso));

export const formatCount = (n: number) => n.toLocaleString("en-US");

export const plural = (n: number, one: string, many = `${one}s`) => `${formatCount(n)} ${n === 1 ? one : many}`;
