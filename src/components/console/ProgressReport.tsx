import clsx from "clsx";
import type { CSSProperties, ReactNode } from "react";
import type { Report } from "@/app/console/_lib/report";
import { formatCents, formatMoney, percent } from "@/app/console/_lib/view";
import { HATCH, TYPICAL_RETURN } from "@/components/insights/widgets/defs";
import type { Recall } from "@/lib/types";
import { firmOf } from "./firm";
import { formatCount, formatDate, formatPeriod, keepHyphens, plural } from "./format";
import { Figure as Digits } from "./Ledger";
import { VerdictMark } from "./VerdictMark";

function H({ children }: { children: ReactNode }) {
  return <h3 className="text-body font-medium">{children}</h3>;
}

const th = "py-2 pr-4 text-left text-micro font-medium text-muted last:pr-0";
const td = "border-t border-line py-2.5 pr-4 align-top last:pr-0";

// CPSC's own wording of units sold, only when it says more than the figure above it (a range, several products).
const cpscUnits = (recall: Recall, sold: number) => (recall.units && recall.units.replace(/[^\d]/g, "") !== String(sold) ? `CPSC: ${recall.units}` : undefined);

/**
 * The CPSC progress-report draft as a paper sheet: always the light tokens, on screen and in print, so what the
 * company sees is what it files. Every number comes from the claim records.
 */
export function ProgressReport({
  recall,
  report,
  generated,
  daysIn,
  reportNo,
  shared = false,
  home = false,
}: {
  recall: Recall;
  report: Report;
  generated: string;
  /** Days the recall has run to the draft's day, its date as day 1 (format.ts recallDays), said beside the period. */
  daysIn?: number;
  /** Which monthly progress report this is in CPSC's sequence (format.ts reportNumber). */
  reportNo?: number;
  /** The workspace is on the shared recall (WorkspaceNote): the sheet says whose run its claims are from, in print too. */
  shared?: boolean;
  /**
   * The homepage's sheet, inside the console tour's frame: sized by its own width, sans figures, and the marks its phone
   * peek (ReportPeek.tsx) cuts on. Its shares are the console's, word for word.
   */
  home?: boolean;
}) {
  const s = report.stats;
  // Every figure in the body face; the console's keep their digits one width (Digits), so a column of counts lines up.
  const figure = "";
  const n = (text: string) => (home ? text : <Digits text={text} />);
  const share = report.outcomes.map((o) => o.share);
  const refused = s.rejected + s.blocked;
  const each = report.paidEachCents === null ? "" : ` at ${formatCents(report.paidEachCents)}`;
  const firm = firmOf(recall);
  return (
    // On screen it is a paper document, like every receipt, tag and notice: the same cream sheet on the homepage and in
    // the console, in both themes (light-theme tokens inside, which pass on --paper), lying in the dark room as on the
    // light page. Printed, plain white (PrintButton turns the page light while it prints).
    <article
      data-theme="light"
      className={clsx(
        "report-sheet w-full max-w-[52rem] rounded-card bg-paper px-6 text-text shadow-[var(--paper-shadow-flat)] print:max-w-none print:rounded-none print:bg-[#fff]! print:p-0 print:shadow-none!",
        home ? "@container mx-auto py-7 sm:px-10 sm:py-9" : "py-8 sm:px-12 sm:py-12",
      )}
    >
      <header className={clsx("flex flex-col gap-3 border-b border-line", home ? "pb-6" : "pb-8")}>
        <p className="text-ui text-muted">Draft · generated {generated}</p>
        <h2 className={clsx("font-medium text-balance", home ? "text-head-sm" : "text-h2")}>
          CPSC {recall.id}: {keepHyphens(recall.product)}
        </h2>
        <p data-peek-hide className="text-ui text-muted">
          {recall.title}
        </p>
        {shared && <p className="text-ui text-muted">Claims from Remedy&rsquo;s own run of public CPSC recall {recall.id}.</p>}
        <dl
          data-peek-hide
          className={clsx(
            "mt-2 grid gap-x-6 gap-y-3 text-ui",
            // The homepage's sheet sizes by its own width (a frame, a tablet column, a phone), never by the window's.
            // In pairs: who and which report, when and over what period, the remedy and its amount. Two to a row on a
            // phone; from a tablet's width three columns of two, filled down each column.
            home
              ? "grid-cols-[repeat(2,minmax(0,1fr))] @min-[40rem]:grid-flow-col @min-[40rem]:grid-cols-[repeat(3,minmax(0,1fr))] @min-[40rem]:grid-rows-2"
              : "grid-cols-2 sm:grid-flow-col sm:grid-cols-3 sm:grid-rows-2",
          )}
        >
          {(
            [
              // The header CPSC's monthly progress report opens with, from the notice and the claims alone: the recalling
              // firm as CPSC's notice names it, and the report's place in the monthly sequence. No contact is guessed.
              firm ? ["Recalling firm", firm] : null,
              reportNo ? ["Progress report", `Monthly, no. ${reportNo}`] : null,
              ["Recall date", formatDate(recall.recallDate)],
              // The period the figures cover: from the recall's date to the day it was drawn up, counted inclusive.
              ["Reporting period", `${formatPeriod(formatDate(recall.recallDate), generated)}${daysIn ? `, ${plural(daysIn, "day")} in` : ""}`],
              ["Remedy offered", "Refund for destroyed units"],
              ["Refund per unit", formatMoney(recall.refund)],
            ] satisfies ([string, string] | null)[]
          )
            .filter((f) => f !== null)
            .map(([k, v]) => (
              <div key={k}>
                <dt className="text-muted">{k}</dt>
                <dd className="mt-0.5">{v}</dd>
              </div>
            ))}
        </dl>
      </header>

      {/* The phone story's closed preview ends here (ReportPeek.tsx): the draft's head, then its progress. */}
      <section data-peek-end className="mt-8 flex flex-col gap-4 break-inside-avoid">
        <H>Progress</H>
        <div data-peek-row className="grid gap-6 sm:grid-cols-3">
          <Figure label="Units sold" value={s.unitsSold ? formatCount(s.unitsSold) : "Not given"} note={cpscUnits(recall, s.unitsSold)} home={home} />
          <Figure label="Units remedied" value={formatCount(s.remedied)} note="Destroyed on camera" home={home} />
          <Figure label="Share remedied" value={percent(s.remedied, s.unitsSold)} note={`${formatCount(s.held)} more waiting for review`} home={home} />
        </div>
        {s.unitsSold > 0 && <ReturnRuler remedied={s.remedied} sold={s.unitsSold} daysIn={daysIn} />}
      </section>

      <section className="mt-10 flex flex-col gap-4 break-inside-avoid">
        <H>Claims by outcome</H>
        {/* On a phone the meaning moves under its outcome, so the table fits the paper without scrolling. */}
        <table className="w-full text-ui">
          <thead>
            <tr>
              <th className={th}>Outcome</th>
              <th className={`${th} text-right`}>Claims</th>
              <th className={`${th} text-right`}>Share</th>
              <th className={`${th} hidden sm:table-cell`}>Meaning</th>
            </tr>
          </thead>
          <tbody>
            {report.outcomes.map((o, i) => (
              <tr key={o.label}>
                <td className={td}>
                  {/* The console's mark and word, in the sheet's ink: a filed document reads in words, not in chips. */}
                  <VerdictMark verdict={o.verdict} className="text-text">
                    {o.label}
                  </VerdictMark>
                  <span className="mt-1.5 block text-muted sm:hidden">{o.note}</span>
                </td>
                <td className={`${td} text-right ${figure}`}>{n(formatCount(o.count))}</td>
                <td className={`${td} text-right ${figure} text-muted`}>{n(share[i])}</td>
                <td className={`${td} hidden text-muted sm:table-cell`}>{o.note}</td>
              </tr>
            ))}
            <tr>
              <td className={`${td} font-medium`}>Total</td>
              <td className={`${td} text-right ${figure} font-medium`}>{n(formatCount(s.total))}</td>
              <td className={td} />
              <td className={`${td} hidden sm:table-cell`} />
            </tr>
          </tbody>
        </table>
      </section>

      {/* The money: what PayPal sent, to how many owners, and how. */}
      <section className="mt-10 flex flex-col gap-4 break-inside-avoid">
        <H>Refunds</H>
        <div className="grid gap-6 sm:grid-cols-3">
          <Figure
            home={home}
            label="Sent through PayPal"
            value={formatCents(report.sentCents)}
            note={`${plural(report.sent, "payout")}${report.sent ? each : ""}${report.settling ? ` · ${formatCount(report.settling)} settling` : report.sent ? " · all settled" : ""}`}
          />
          <Figure label="Method" value="PayPal" note="Payouts to each owner’s verified PayPal account" home={home} />
        </div>
      </section>

      {/* The figures CPSC's Monthly Progress Report asks for, from the claims alone; what Remedy can't know is named, not
          guessed. The homepage's sheet carries them too: it is the console's draft, word for word. */}
      <section className="mt-10 flex flex-col gap-4 break-inside-avoid">
        <H>For the monthly progress report</H>
        <table className="w-full text-ui">
          <tbody>
            {(
              [
                ["Units corrected by refund", formatCount(report.correctedByRefund), "Destroyed on camera; refund sent through PayPal"],
                // Remedied but not yet corrected: the refund is approved and PayPal hasn't sent it.
                report.approvedUnsent ? ["Destroyed on camera, refund approved, not yet sent", formatCount(report.approvedUnsent), "Counted as corrected once PayPal sends the refund"] : null,
                ["Units corrected by repair or replacement", "0", "The remedy is a refund"],
                [
                  "Units remaining at consumer level",
                  s.unitsSold ? formatCount(Math.max(0, s.unitsSold - report.correctedByRefund)) : "Not given",
                  s.unitsSold
                    ? `${formatCount(s.unitsSold)} sold less ${formatCount(report.correctedByRefund)} corrected: every unit sold counts as with a consumer until it is corrected`
                    : "Units sold less units corrected, once CPSC gives units sold",
                ],
                ["Claims in progress or held", formatCount(s.pending + s.held), "Not yet counted as corrected"],
              ] satisfies ([string, string, string] | null)[]
            )
              .filter((r) => r !== null)
              .map(([k, v, note]) => (
                <tr key={k}>
                  <td className={`${td} text-text`}>
                    {k}
                    <span className="mt-1 block text-muted sm:hidden">{note}</span>
                  </td>
                  <td className={`${td} w-24 text-right`}>{/\d/.test(v) ? n(v) : v}</td>
                  <td className={`${td} hidden text-muted sm:table-cell`}>{note}</td>
                </tr>
              ))}
          </tbody>
        </table>
        <p className="max-w-read text-ui text-muted">
          Units still with manufacturers, distributors or retailers, and your notices, posters and posts, come from your own records: Remedy sees claims only.
        </p>
      </section>

      <section className="mt-10 flex flex-col gap-4 break-inside-avoid">
        <H>Why claims were refused</H>
        {refused ? (
          <table className="w-full text-ui">
            <tbody>
              {report.refusals.map((r) => (
                <tr key={r.reason}>
                  <td className={`${td} text-text`}>{r.reason}</td>
                  <td className={`${td} w-20 text-right ${figure}`}>{n(formatCount(r.count))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-ui text-muted">No claims were refused.</p>
        )}
        <p className="text-ui text-muted">
          A refused claim moves no money. The owner is told the exact reason and how to claim again.
        </p>
      </section>

      {/* One short paragraph and the footer, kept whole on one printed page with the heading: no two lines, and no
          footer, left alone on the next page. */}
      <div className="break-inside-avoid">
        <section className="mt-10 flex flex-col gap-3">
          <H>How units were verified</H>
          <p className="max-w-read text-ui text-text">
            Each owner logged in with PayPal, received a one-time code, and photographed the destroyed product with the code written on it, using a live camera
            session of 10 minutes with no upload option. Before any photo was examined, Remedy checked the session, refused reused photos and second claims
            from one account, and required a verified PayPal account. A vision model then described the label, the code and each destruction step, quoting
            what it saw; a fixed rule paid only when every answer passed, and held any unclear answer for a person.
          </p>
        </section>

        <footer className="mt-12 border-t border-line pt-4 text-micro text-muted">
          Draft for your review before filing. Days are in UTC, as in the console.
        </footer>
      </div>
    </article>
  );
}

const RULER = 0.12;
const on = (share: number) => `${(Math.min(share, RULER) / RULER) * 100}%`;

/** Units remedied on a 4px ruler to 12%, with the 6-10% share recalls typically reach as a hatched band, as Insights
 * draws it: the scale is honest, so a young recall's sliver sits plainly next to the band. Each says what it measures,
 * as Insights' does: the marker this recall so far (days in), the band a whole recall's lifetime, with its source. */
function ReturnRuler({ remedied, sold, daysIn }: { remedied: number; sold: number; daysIn?: number }) {
  const share = remedied / sold;
  return (
    <div className="flex flex-col gap-2">
      {/* The paper's inks: the sheet is light-themed paper wherever it lies. */}
      <p aria-hidden="true" className="text-micro text-pay in-data-[theme=light]:text-pay-ink">
        This recall{daysIn ? `, ${plural(daysIn, "day")} in` : " so far"}
      </p>
      <div
        role="meter"
        aria-label="Units remedied of units sold"
        aria-valuemin={0}
        aria-valuemax={sold}
        aria-valuenow={remedied}
        aria-valuetext={`${percent(remedied, sold)}${daysIn ? `, ${plural(daysIn, "day")} in` : ""}; over a whole recall, recalls typically reach ${TYPICAL_RETURN.from * 100} to ${TYPICAL_RETURN.to * 100}%`}
        // Printed with its colours, background graphics on or off: the report's one graphic.
        className="relative h-1 rounded-full bg-surface-3 [--hatch:var(--faint)] in-data-[theme=light]:bg-paper-2 in-data-[theme=light]:[--hatch:var(--ink-muted)] [print-color-adjust:exact] [-webkit-print-color-adjust:exact] *:[print-color-adjust:exact] *:[-webkit-print-color-adjust:exact]"
      >
        <span
          aria-hidden="true"
          className="absolute -inset-y-px rounded-[2px]"
          style={{
            left: on(TYPICAL_RETURN.from),
            width: `calc(${on(TYPICAL_RETURN.to)} - ${on(TYPICAL_RETURN.from)})`,
            ...HATCH,
          }}
        />
        <span aria-hidden="true" className="absolute inset-y-0 left-0 rounded-full bg-pay in-data-[theme=light]:bg-pay-ink" style={{ width: `max(3px, ${on(share)})` }} />
      </div>
      <p aria-hidden="true" className="relative h-4 text-micro text-muted">
        <span className="absolute left-0">0%</span>
        {/* Under the band, from its start; below 768px ending at its end, so it never runs into the scale's last figure. */}
        <span
          className="absolute whitespace-nowrap max-md:right-[calc(100%-var(--to))] md:left-(--from)"
          style={{ "--from": on(TYPICAL_RETURN.from), "--to": on(TYPICAL_RETURN.to) } as CSSProperties}
        >
          <span className="md:hidden">Whole recall, </span>
          <span className="max-md:hidden">Typical over a whole recall, </span>
          {TYPICAL_RETURN.from * 100}–{TYPICAL_RETURN.to * 100}%<span className="max-md:hidden"> ({TYPICAL_RETURN.source.replace(/^PIRG, .*?, /, "PIRG, ")})</span>
        </span>
        <span className="absolute right-0">{RULER * 100}%</span>
      </p>
    </div>
  );
}

// The homepage's figures are set as the rest of its section sets them: regular weight, proportional figures (tabular
// ones space a stop or a colon like mono).
function Figure({ label, value, note, more, home }: { label: string; value: string; note?: string; more?: string; home?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-ui text-muted">{label}</span>
      <span className={clsx("text-head-sm", !home && "font-medium")}>{home ? value : <Digits text={value} />}</span>
      {note && (
        <span data-peek-hide className="text-ui text-muted">
          {note}
        </span>
      )}
      {more && (
        <span data-peek-hide className="text-ui text-pretty text-muted">
          {more}
        </span>
      )}
    </div>
  );
}
