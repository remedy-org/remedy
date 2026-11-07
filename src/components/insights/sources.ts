import type { AgDataSourcesDefinition, AgFieldDefinition, AgFormat } from "ag-studio";
import type { InsightsData } from "@/app/console/insights/facts";
import type { InsightsRegistry } from "./widgets/defs";

// AG Studio's data sources for one recall: its claims, their checks (many to one), the recall itself and a calendar on
// the day a claim was filed. Every description is read by the analyst, so each one says what the numbers are and
// what they are not.

export const CALENDAR_ID = "calendar";

type Spec = [id: string, name: string, format: AgFormat, extra?: Partial<AgFieldDefinition>];
const fields = (specs: Spec[]): AgFieldDefinition[] => specs.map(([id, name, format, extra]) => ({ id, name, format, ...extra }));

const usd = { formatOptions: { format: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }) } };
const secs = { formatOptions: { format: new Intl.NumberFormat("en-US", { style: "unit", unit: "second", unitDisplay: "narrow", maximumFractionDigits: 0 }) } };
const whole = { formatOptions: { format: new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }) } };

const HONESTY =
  "Sample claims (source = Sample) are eval samples shown in every company's console; they were never paid to a real owner. " +
  "Judges' demo claims used sample photos and PayPal sandbox money. Amounts are USD sent from Remedy's PayPal sandbox account for the company.";

export function buildSources(data: InsightsData): AgDataSourcesDefinition<InsightsRegistry> {
  const days = data.claims.map((c) => c.filedAt.slice(0, 10)).sort();
  const today = data.asOf.slice(0, 10);
  return {
    description: `Claims filed against CPSC recall ${data.recall.id} (${data.recall.product}), and the checks that decided them. ${HONESTY} A fixed rule decides every claim from the checks: any "no" rejects, any "unclear" holds it for a person. The model only describes the photos.`,
    sources: [
      {
        id: "claims",
        name: "Claims",
        description: `One row per claim. ${HONESTY}`,
        data: data.claims,
        fields: fields([
          ["id", "Claim", "textFormat"],
          ["filedAt", "Filed", "dateTimeFormat", { formatOptions: { format: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) } }],
          ["decision", "Decision", "textFormat"],
          ["decisionRank", "Decision order", "integerFormat", { hide: true, description: "1 Paid, 2 Held, 3 Rejected, 4 Blocked, 5 In progress." }],
          ["refusalReason", "Refusal reason", "textFormat", { description: "Why a rejected or blocked claim was refused, in the CPSC report's wording. Blank for other claims." }],
          ["refusalGate", "Refused by", "textFormat", { description: "The kind of check that refused the claim: No AI (a pre-check), Model reads (the photo check) or Person (a review). Blank unless refused." }],
          ["failedCheck", "Deciding check", "textFormat", { description: "The check that refused or held the claim (code, label, same_item, screen, step_N, session, duplicate_photo, payer, payer_verified, review)." }],
          ["reason", "Reason", "textFormat"],
          ["source", "Source", "textFormat", { description: "Sample, Judges' demo or Owner." }],
          ["payer", "PayPal account", "textFormat", { description: "Last four characters of the PayPal payer id only." }],
          ["verified", "PayPal verified", "booleanFormat"],
          ["amountPaid", "Paid out", "currencyFormat", { ...usd, description: "USD sent through PayPal for this claim; 0 unless paid." }],
          ["remedied", "Units remedied", "integerFormat", { ...whole, description: "1 when the claim was paid: a unit destroyed and refunded." }],
          ["remediedSample", "Sample units remedied", "integerFormat", { ...whole, hide: true, description: "1 when a sample claim was decided paid. Its payout was never sent to a real owner." }],
          ["refused", "Refused", "integerFormat", { ...whole, description: "1 when the claim was rejected or blocked." }],
          ["held", "Held", "integerFormat", { ...whole, description: "1 when the claim waits for a person." }],
          ["timeToPaySec", "Photo to PayPal", "decimalFormat", { ...secs, description: "Seconds from the photos arriving to the payout being sent. Paid claims only." }],
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
