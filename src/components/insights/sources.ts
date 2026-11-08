import type { AgDataSourcesDefinition, AgFieldDefinition, AgFormat } from "ag-studio";
import { duration } from "@/app/console/_lib/view";
import type { InsightsData } from "@/app/console/insights/facts";
import { captions, provenance } from "./report";
import type { InsightsRegistry } from "./widgets/defs";

// AG Studio's data sources for one recall: its claims, their checks (many to one), the recall itself and a calendar on
// the day a claim was filed. Every description is read by the analyst, so each one says what the numbers are and
// what they are not.

export const CALENDAR_ID = "calendar";

type Spec = [id: string, name: string, format: AgFormat, extra?: Partial<AgFieldDefinition>];
const fields = (specs: Spec[]): AgFieldDefinition[] => specs.map(([id, name, format, extra]) => ({ id, name, format, ...extra }));

const usd = { formatOptions: { format: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }) } };
// Durations read as the console's do: "0:03", "1h 06m".
const secs = { createValueFormatter: () => (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? duration(Math.round(v)) : "") };
const whole = { formatOptions: { format: new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }) } };

const HONESTY =
  "Starter claims (source = Starter) come with every company's console and are never paid. " +
  "Demo claims (source = Demo) come from the try page. Amounts are USD sent through PayPal.";

export function buildSources(data: InsightsData): AgDataSourcesDefinition<InsightsRegistry> {
  const days = data.claims.map((c) => c.filedAt.slice(0, 10)).sort();
  const today = data.asOf.slice(0, 10);
  const { timeField } = captions(provenance(data.claims));
  const sent = timeField === "timeToSendSec";
  return {
    description: `Claims filed against CPSC recall ${data.recall.id} (${data.recall.product}), and the checks that decided them. ${HONESTY} A fixed rule decides every claim from the checks: any "no" rejects, any "unclear" holds it for a person. The model only describes the photos.`,
    sources: [
      {
        id: "claims",
        name: "Claims",
        description: `One row per claim. ${HONESTY}`,
        data: data.claims,
        fields: fields([
          // The grid widget renders this column as a link to the claim in the queue (widgets/index.ts).
          ["id", "Claim", "textFormat", { context: { claimOf: data.recall.id } }],
          ["filedAt", "Filed", "dateTimeFormat", { formatOptions: { format: new Intl.DateTimeFormat("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC", timeZoneName: "short" }) } }],
          ["decision", "Decision", "textFormat"],
          ["decisionRank", "Decision order", "integerFormat", { hide: true, description: "1 Paid, 2 Held, 3 Rejected, 4 Blocked, 5 In progress." }],
          ["refusalReason", "Refusal reason", "textFormat", { description: "Why a rejected or blocked claim was refused, in the CPSC report's wording. Blank for other claims." }],
          ["refusalGate", "Refused by", "textFormat", { description: "The kind of check that refused the claim: No AI (a pre-check), Model reads (the photo check) or Person (a review). Blank unless refused." }],
          ["failedCheck", "Deciding check", "textFormat", { description: "The check that refused or held the claim (code, label, same_item, screen, step_N, session, duplicate_photo, payer, payer_verified, review)." }],
          ["reason", "Reason", "textFormat"],
          ["source", "Source", "textFormat", { description: "Starter, Demo or Owner." }],
          ["payer", "PayPal account", "textFormat", { description: "Last four characters of the PayPal payer id only." }],
          ["verified", "PayPal verified", "booleanFormat"],
          ["amountPaid", "Paid out", "currencyFormat", { ...usd, description: "USD the rule paid for this claim; 0 unless paid. On a starter claim it was approved, never sent." }],
          ["refund", "Refund", "textFormat", { description: "The refund as the console shows it: the amount, \"· approved\" on a starter claim, \"· not sent\" on a held one, or — when the claim was refused or is in progress." }],
          ["amountSent", "Paid through PayPal", "currencyFormat", { ...usd, description: "USD sent through PayPal; 0 for starter claims, whose payouts never left." }],
          ["remedied", "Units remedied", "integerFormat", { ...whole, description: "1 when the claim was paid: a unit destroyed and refunded." }],
          ["remediedSample", "Starter units remedied", "integerFormat", { ...whole, hide: true, description: "1 when a starter claim was approved. Its payout was never sent." }],
          ["refused", "Refused", "integerFormat", { ...whole, description: "1 when the claim was rejected or blocked." }],
          ["held", "Held", "integerFormat", { ...whole, description: "1 when the claim waits for a person." }],
          ["timeToPaySec", "Photo to PayPal", "decimalFormat", { ...secs, description: "Seconds from the photos arriving to the payout being sent. Paid claims only; a starter claim's are its seeded timings." }],
          ["timeToSendSec", "Photo to PayPal, sent", "decimalFormat", { ...secs, description: "Seconds from the photos arriving to a payout really sent through PayPal. Blank for starter claims." }],
          ["paidOnReview", "Paid on review", "integerFormat", { ...whole, description: "1 when the claim was paid only after a person approved it on review; its time to pay includes that wait." }],
          ["modelSec", "Photo check time", "decimalFormat", { ...secs, description: "Seconds from the photos arriving to the model's answer." }],
          ["photoCount", "Photos", "integerFormat"],
          ["payoutStatus", "PayPal status", "textFormat", { description: "PayPal's own payout status: SUCCESS, PENDING, UNCLAIMED and so on." }],
          ["stage", "Furthest stage", "textFormat", { description: "The last stage the claim passed: Filed, Photos sent, Passed pre-checks, Passed photo check, Paid." }],
          ["stopReason", "Stopped because", "textFormat", { description: "Why the claim went no further than its furthest stage. Blank for paid claims." }],
        ]),
      },
      {
        id: "checks",
        name: "Checks",
        description: "One row per check the rule recorded for a claim: the model's photo checks for every claim it read, plus any pre-check that failed. Passing pre-checks aren't recorded.",
        data: data.checks,
        fields: fields([
          ["id", "Check id", "textFormat", { hide: true }],
          ["claimId", "Claim", "textFormat", { hide: true }],
          ["check", "Check", "textFormat"],
          ["stage", "Check stage", "textFormat", { description: "Pre-check (no AI) or Photo check (the model reads the photo)." }],
          ["outcome", "Check outcome", "textFormat", { description: "Passed, Held (the model was unsure) or Refused." }],
        ]),
      },
      {
        id: "recall",
        name: "Recall",
        description: "The recall itself: one row.",
        data: [data.recall],
        fields: fields([
          ["id", "CPSC recall", "textFormat"],
          ["product", "Product", "textFormat"],
          ["slug", "Claim link", "textFormat", { hide: true }],
          ["unitsSold", "Units sold", "integerFormat", { ...whole, description: "Units sold, from the CPSC notice." }],
          ["refund", "Refund", "currencyFormat", { ...usd }],
          ["autoPay", "Auto-pay", "booleanFormat"],
        ]),
      },
    ],
    relationships: [
      { id: "check-claim", source: { tableId: "checks", fieldId: "claimId" }, target: { tableId: "claims", fieldId: "id" }, type: "many-to-one" },
      { id: "claims-filedAt-calendar", source: { tableId: "claims", fieldId: "filedAt" }, target: { calendarId: CALENDAR_ID }, truncate: "day" },
    ],
    // Studio's aggregations have no median, and an average of payouts that take seconds turns into minutes with one
    // claim a person approved later. This measure works under a grouping (Exhibit E, by day); a value tile asks for it
    // ungrouped and gets nothing, so the KPI tile uses the median-time widget instead. It is the tile's own median, over
    // the same field (payouts really sent, or the photo check's time while none was), so the chart and the tile agree.
    expressions: [
      {
        id: "medianToPaySec",
        name: sent ? "Median photo to PayPal" : "Median photo check",
        description: sent
          ? "Median seconds from photos to a payout really sent through PayPal; starter claims, whose payouts never left, are not in it. Use it grouped, by day or by source; for one overall figure use the Median time widget."
          : "No payout has been sent yet, so this is the median seconds from photos to the model's answer. Use it grouped, by day or by source; for one overall figure use the Median time widget.",
        isMeasure: true,
        format: "decimalFormat",
        expression: { operator: "median", inputs: [{ id: `claims.${timeField}` }] },
        ...secs,
      },
    ],
    calendars: [
      {
        id: CALENDAR_ID,
        label: "Calendar",
        range: { from: { type: "date", value: days[0] ?? today }, to: { type: "date", value: days.at(-1) ?? today } },
        fragments: ["month", "week", "day", "dayOfWeek"],
      },
    ],
  };
}
