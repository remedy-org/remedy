// Display formats shared by the console's server and client components, in the claim flow's order ("5 Nov 2026").
// Times are in UTC and say so, like the receipt's "7 Nov 2026, 14:32 UTC"; dates (CPSC's recall date) are calendar
// dates with no zone.

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** "2026-11-05" -> "5 Nov 2026". */
export const formatDate = (isoDate: string) => dateFmt.format(new Date(`${isoDate.slice(0, 10)}T00:00:00Z`));

/** The day a moment fell on in UTC, the console's one zone: "6 Nov 2026". The report says so once, so a day in it is
 * the same day as in the grid, the CSV and Insights, whatever the server's or the viewer's zone. */
export const formatDay = (iso: string) => dateFmt.format(new Date(iso));

const DAY = 86_400_000;

/** How many days a recall has run at `now`, counted as its reporting period reads: inclusive, in UTC days, the recall's own
 * date being day 1 ("5–9 Nov" is 5 days). The report's "5 days in", its preview's and Insights' "1 in 5 days" all read it. */
export const recallDays = (recallDate: string, now: Date) =>
  Math.max(1, Math.floor(now.getTime() / DAY) - Math.floor(Date.parse(`${recallDate.slice(0, 10)}T00:00:00Z`) / DAY) + 1);

/** Which monthly progress report a draft at `now` is, in CPSC's sequence: 1 in the recall's first month (its date up to
 * the day before the same date a month on), 2 in its second, and so on. */
export function reportNumber(recallDate: string, now: Date): number {
  const [y, m, d] = recallDate.slice(0, 10).split("-").map(Number);
  const months = (now.getUTCFullYear() - y) * 12 + (now.getUTCMonth() + 1 - m) - (now.getUTCDate() < d ? 1 : 0);
  return Math.max(1, months + 1);
}

/** A reporting period from the recall's date to the draft's day, as short as it reads: "5–8 Nov 2026",
 * "28 Nov – 3 Dec 2026", "20 Dec 2026 – 4 Jan 2027". Both ends are formatDate's "5 Nov 2026". */
export function formatPeriod(from: string, to: string): string {
  const [d1, m1, y1] = from.split(" ");
  const [d2, m2, y2] = to.split(" ");
  if (from === to) return to;
  if (y1 !== y2) return `${from} – ${to}`;
  return m1 === m2 ? `${d1}–${d2} ${m2} ${y2}` : `${d1} ${m1} – ${d2} ${m2} ${y2}`;
}

const timeFmt = new Intl.DateTimeFormat("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC", timeZoneName: "short" });

/** "7 Nov, 14:02 UTC". */
export const formatTime = (iso: string) => timeFmt.format(new Date(iso));

const dayTimeFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });

/** "7 Nov 14:02" (UTC): a grid row's filing time, with its day, so a list that spans days reads in order. */
export const formatDayTime = (iso: string) => dayTimeFmt.format(new Date(iso)).replace(",", "");

/** "14:02:05", in UTC like formatTime, beside which it is shown. */
const clockFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZone: "UTC" });
export const formatClock = (iso: string) => clockFmt.format(new Date(iso));

/** What a check's answer that didn't pass says in a word, after its name ("X-VESOLJE tag on the cut pillow: couldn’t
 * tell"): the evidence panel's check rows and the homepage's still of it. */
export const PART_STATE: Partial<Record<string, string>> = { hold: "couldn’t tell", reject: "failed" };

export const formatCount = (n: number) => n.toLocaleString("en-US");

export const plural = (n: number, one: string, many = `${one}s`) => `${formatCount(n)} ${n === 1 ? one : many}`;

/** A product name as one string that never breaks at its hyphens ("X-VESOLJE"): a word joiner after each one. One text
 * node, so a screen reader hears the name as written, spaces and all. */
export const keepHyphens = (text: string) => text.replace(/-/g, "-\u2060");
