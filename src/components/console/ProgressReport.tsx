import clsx from "clsx";
import type { CSSProperties, ReactNode } from "react";
import type { Report } from "@/app/console/_lib/report";
import { formatCents, formatMoney, percent } from "@/app/console/_lib/view";
import { TYPICAL_RETURN } from "@/components/insights/widgets/defs";
import type { Recall } from "@/lib/types";
import { formatCount, formatDate, formatPeriod, keepHyphens, plural } from "./format";
import { Figure as Digits } from "./Ledger";
import { VerdictMark } from "./VerdictMark";

function H({ children }: { children: ReactNode }) {
  return <h3 className="text-body font-medium">{children}</h3>;
}

const th = "py-2 pr-4 text-left text-micro font-medium text-muted last:pr-0";
const td = "border-t border-line py-2.5 pr-4 align-top last:pr-0";

/**
 * Shares of a total to one decimal place that add up to 100.0% (largest remainder over tenths), so two equal counts
 * always show the same share and the column never totals 100.1%.
 */
export function shares(counts: number[]): string[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return counts.map(() => "0%");
  const raw = counts.map((c) => (c / total) * 1000);
  const floor = raw.map((r) => Math.floor(r + 1e-9));
  let left = 1000 - floor.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r + 1e-9), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) if (left-- > 0) floor[i]++;
  // A whole share prints whole (65%, not 65.0%), as the console's own report does.
  return floor.map((n) => `${(n / 10).toFixed(1).replace(/\.0$/, "")}%`);
}

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
  home = false,
}: {
  recall: Recall;
  report: Report;
  generated: string;
  /** Whole days from the recall's date to the draft's, said beside the reporting period. */
  daysIn?: number;
  /**
   * The homepage's sheet, inside the console tour's frame: sized by its own width, sans figures, shares to one decimal
   * that add up to 100.0%, and the marks its phone peek (ReportPeek.tsx) cuts on.
   */
  home?: boolean;
}) {
  const s = report.stats;
  // Every figure in the body face; the console's keep their digits one width (Digits), so a column of counts lines up.
  const figure = "";
  const n = (text: string) => (home ? text : <Digits text={text} />);
  const share = home ? shares(report.outcomes.map((o) => o.count)) : report.outcomes.map((o) => o.share);
  const refused = s.rejected + s.blocked;
  const each = report.paidEachCents === null ? "" : ` at ${formatCents(report.paidEachCents)}`;
  return (
    // On screen it is a paper document, like every receipt, tag and notice (light-theme tokens inside, which pass on
    // --paper); printed, plain white.
    <article
      // The homepage's sheet is paper in both themes; the console's takes the page's theme on screen (a dark sheet in the
      // dark room, the paper in light), and prints light on white (PrintButton turns the page light while it prints).
      data-theme={home ? "light" : undefined}
      className={clsx(
        "report-sheet w-full max-w-[52rem] rounded-card px-6 text-text print:max-w-none print:rounded-none print:!bg-white print:p-0 print:!shadow-none",
        home ? "bg-paper shadow-[var(--paper-shadow-flat)]" : "bg-surface shadow-[0_0_0_1px_var(--line-2)] in-data-[theme=light]:bg-paper in-data-[theme=light]:shadow-[var(--paper-shadow-flat)]",
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
        <dl
          data-peek-hide
          className={clsx(
            "mt-2 grid gap-x-6 gap-y-3 text-ui",
            // The homepage's sheet sizes by its own width (a frame, a tablet column, a phone), never by the window's.
            home ? "grid-cols-[repeat(2,minmax(0,1fr))] @min-[40rem]:grid-cols-[repeat(4,max-content)] @min-[40rem]:justify-between" : "grid-cols-2 sm:grid-cols-4",
          )}
        >
          {[
            ["Recall date", formatDate(recall.recallDate)],
            ["Remedy", "Refund for destroyed units"],
            ["Refund per unit", formatMoney(recall.refund)],
            // The period the report covers: from the recall's date to the day it was drawn up, as CPSC's monthly report reads.
            ["Reporting period", `${formatPeriod(formatDate(recall.recallDate), generated)}${daysIn ? `, ${plural(daysIn, "day")} in` : ""}`],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-muted">{k}</dt>
              <dd className="mt-0.5">{v}</dd>
            </div>
          ))}
        </dl>
      </header>

      {/* The phone story's closed preview ends here (ReportPeek.tsx): the draft's head, then its units remedied. */}
      <section data-peek-end className="mt-8 flex flex-col gap-4 break-inside-avoid">
        <H>Units remedied</H>
        <div data-peek-row className="grid gap-6 sm:grid-cols-3">
          <Figure label="Units sold" value={s.unitsSold ? formatCount(s.unitsSold) : "Not given"} note={cpscUnits(recall, s.unitsSold)} home={home} />
          <Figure label={home ? "Remedied" : "Units remedied"} value={formatCount(s.remedied)} note="Destroyed on camera" home={home} />
          <Figure label="Correction rate" value={percent(s.remedied, s.unitsSold)} note={`${formatCount(s.held)} more waiting for review`} home={home} />
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
              <tr key={o.decision}>
                <td className={td}>
                  {/* The console's mark and word, in the sheet's ink: a filed document reads in words, not in chips. */}
                  <VerdictMark verdict={o.decision === "paid" ? (o.label === "Paid" ? "paid" : "approved") : o.decision} className="text-text">
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
          <Figure label="Method" value="PayPal" note="Payouts to each owner's verified PayPal account" home={home} />
        </div>
      </section>

      {/* The figures CPSC's Monthly Progress Report asks for, from the claims alone; what Remedy can't know is named, not
          guessed. */}
      {!home && (
        <section className="mt-10 flex flex-col gap-4 break-inside-avoid">
          <H>For the monthly progress report</H>
          <table className="w-full text-ui">
            <tbody>
              {(
                [
                  ["Units corrected by refund", formatCount(s.remedied), "Destroyed on camera and approved"],
                  ["Units corrected by repair or replacement", "0", "The remedy is a refund"],
                  ["Units remaining at consumer level", s.unitsSold ? formatCount(Math.max(0, s.unitsSold - s.remedied)) : "Not given", "Units sold less units corrected"],
                  ["Claims in progress or held", formatCount(s.pending + s.held), "Not yet counted as corrected"],
                ] as const
              ).map(([k, v, note]) => (
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
      )}

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
          {home ? "" : "A refused claim moves no money. "}The owner is told the exact reason and how to claim again.
        </p>
      </section>

      {/* Prose: it may break across printed pages, rather than leave one paragraph alone on the last. */}
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
        Draft for your review before filing.{home ? "" : " Days are in UTC, as in the console."}
      </footer>
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
      {/* On paper (light) the paper's inks; on the console's dark sheet, the room's own. */}
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
            background: "repeating-linear-gradient(135deg, var(--hatch) 0 1px, transparent 1px 5px)",
          }}
        />
        <span aria-hidden="true" className="absolute inset-y-0 left-0 rounded-full bg-pay in-data-[theme=light]:bg-pay-ink" style={{ width: `max(3px, ${on(share)})` }} />
      </div>
      <p aria-hidden="true" className="relative h-4 text-micro text-muted">
        <span className="absolute left-0">0%</span>
        {/* Under the band, from its start; on a phone ending at its end, so it never runs into the scale's last figure. */}
        <span
          className="absolute whitespace-nowrap max-sm:right-[calc(100%-var(--to))] sm:left-(--from)"
          style={{ "--from": on(TYPICAL_RETURN.from), "--to": on(TYPICAL_RETURN.to) } as CSSProperties}
        >
          <span className="sm:hidden">Whole recall, </span>
          <span className="max-sm:hidden">Typical over a whole recall, </span>
          {TYPICAL_RETURN.from * 100}–{TYPICAL_RETURN.to * 100}%<span className="max-sm:hidden"> ({TYPICAL_RETURN.source.replace(/^PIRG, .*?, /, "PIRG, ")})</span>
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
