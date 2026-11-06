// Display formats shared by the console's server and client components. Times are in the viewer's own zone on the
// client; dates (CPSC's recall date) are calendar dates with no zone.

const dateFmt = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** "2026-11-05" -> "Nov 5, 2026". */
export const formatDate = (isoDate: string) => dateFmt.format(new Date(`${isoDate.slice(0, 10)}T00:00:00Z`));

const etFmt = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "America/New_York" });

/** The day a moment fell on in US Eastern time, CPSC's zone: "Nov 6, 2026". The report labels it "(ET)", so server
 * and viewer agree whatever their own zones. */
export const formatDayET = (iso: string) => etFmt.format(new Date(iso));

const timeFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** "Nov 7, 14:02" in the viewer's zone. Client components only, or the server's zone leaks in. */
export const formatTime = (iso: string) => timeFmt.format(new Date(iso));

const clockFmt = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
export const formatClock = (iso: string) => clockFmt.format(new Date(iso));

export const formatCount = (n: number) => n.toLocaleString("en-US");

export const plural = (n: number, one: string, many = `${one}s`) => `${formatCount(n)} ${n === 1 ? one : many}`;
