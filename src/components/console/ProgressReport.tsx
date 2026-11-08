import clsx from "clsx";
import type { CSSProperties, ReactNode } from "react";
import type { Report } from "@/app/console/_lib/report";
import { formatCents, formatMoney, percent } from "@/app/console/_lib/view";
import { StatusPill } from "@/components/ui";
import { TYPICAL_RETURN } from "@/components/insights/widgets/defs";
import type { Recall } from "@/lib/types";
import { formatCount, formatDate, keepHyphens, plural } from "./format";
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
  if (!total) return counts.map(() => "0.0%");
  const raw = counts.map((c) => (c / total) * 1000);
  const floor = raw.map((r) => Math.floor(r + 1e-9));
  let left = 1000 - floor.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r + 1e-9), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) if (left-- > 0) floor[i]++;
  return floor.map((n) => `${(n / 10).toFixed(1)}%`);
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
  home = false,
}: {
  recall: Recall;
  report: Report;
  generated: string;
  /**
   * The homepage's sheet, inside the console tour's frame: sized by its own width, sans figures, shares to one decimal
   * that add up to 100.0%, no ruler, and the marks its phone peek (ReportPeek.tsx) cuts on.
   */
  home?: boolean;
}) {
  const s = report.stats;
  // The homepage's figures are proportional: this sans's tabular ones space a stop like mono ("65 . 0%").
  const figure = home ? "" : "font-mono";
  const share = home ? shares(report.outcomes.map((o) => o.count)) : report.outcomes.map((o) => o.share);
  const refused = s.rejected + s.blocked;
  const each = report.paidEachCents === null ? "" : ` at ${formatCents(report.paidEachCents)}`;
  return (
    // On screen it is a paper document, like every receipt, tag and notice (light-theme tokens inside, which pass on
    // --paper); printed, plain white.
    <article
      data-theme="light"
      className={clsx(
        "w-full max-w-[52rem] rounded-card bg-paper px-6 text-text shadow-[var(--paper-shadow-flat)] print:max-w-none print:rounded-none print:bg-white print:p-0 print:shadow-none",
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
            ["Reporting period", `${formatDate(recall.recallDate)} to ${generated}`],
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
        {s.unitsSold > 0 && !home && <ReturnRuler remedied={s.remedied} sold={s.unitsSold} />}
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
                  {home ? (
                    <span className="inline-flex w-(--verdict-pill-w)">
                      <StatusPill status={o.decision} label={o.label} />
                    </span>
                  ) : (
                    // The console's mark and word, in the sheet's ink: a filed document reads in words, not in chips.
                    <VerdictMark verdict={o.decision === "paid" ? (o.label === "Paid" ? "paid" : "approved") : o.decision} className="text-text">
                      {o.label}
                    </VerdictMark>
                  )}
                  <span className="mt-1.5 block text-muted sm:hidden">{o.note}</span>
                </td>
                <td className={`${td} text-right ${figure}`}>{formatCount(o.count)}</td>
                <td className={`${td} text-right ${figure} text-muted`}>{share[i]}</td>
                <td className={`${td} hidden text-muted sm:table-cell`}>{o.note}</td>
              </tr>
            ))}
            <tr>
              <td className={`${td} font-medium`}>Total</td>
              <td className={`${td} text-right ${figure} font-medium`}>{formatCount(s.total)}</td>
              <td className={td} />
              <td className={`${td} hidden sm:table-cell`} />
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mt-10 flex flex-col gap-4 break-inside-avoid">
        <H>Refunds</H>
        <div className="grid gap-6 sm:grid-cols-3">
          <Figure label="Approved" value={formatCents(report.sentCents + report.sampleCents)} note={plural(s.remedied, "refund")} home={home} />
          <Figure
            home={home}
            label="Sent"
            value={formatCents(report.sentCents)}
            note={`${plural(report.sent, "payout")}${report.sent ? each : ""}${report.settling ? ` · ${formatCount(report.settling)} settling` : report.sent ? " · all settled" : ""}`}
          />
          <Figure label="Method" value="PayPal" note="Payouts to each owner's verified PayPal account" home={home} />
        </div>
      </section>

      <section className="mt-10 flex flex-col gap-4 break-inside-avoid">
        <H>Why claims were refused</H>
        {refused ? (
          <table className="w-full text-ui">
            <tbody>
              {report.refusals.map((r) => (
                <tr key={r.reason}>
                  <td className={`${td} text-text`}>{r.reason}</td>
                  <td className={`${td} w-20 text-right ${figure}`}>{formatCount(r.count)}</td>
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

      <section className="mt-10 flex flex-col gap-3 break-inside-avoid">
        <H>How units were verified</H>
        <p className="max-w-read text-ui text-text">
          Each owner logged in with PayPal, received a one-time code, and photographed the destroyed product with the code written on it, using a live camera
          session of 10 minutes with no upload option. Before any photo was examined, Remedy checked the session, refused reused photos and second claims
          from one account, and required a verified PayPal account. A vision model then described the label, the code and each destruction step, quoting
          what it saw; a fixed rule paid only when every answer passed, and held any unclear answer for a person.
        </p>
      </section>

      <footer className="mt-12 border-t border-line pt-4 text-micro text-muted">
        Draft for review, not for filing.
      </footer>
    </article>
  );
}

const RULER = 0.12;
const on = (share: number) => `${(Math.min(share, RULER) / RULER) * 100}%`;

/** Units remedied on a 4px ruler to 12%, with the 6-10% share recalls typically reach as a hatched band, as Insights
 * draws it: the scale is honest, so a young recall's sliver sits plainly next to the band. */
function ReturnRuler({ remedied, sold }: { remedied: number; sold: number }) {
  const share = remedied / sold;
  return (
    <div className="flex flex-col gap-2">
      <div
        role="meter"
        aria-label="Units remedied of units sold"
        aria-valuemin={0}
        aria-valuemax={sold}
        aria-valuenow={remedied}
        aria-valuetext={`${percent(remedied, sold)}; recalls typically reach ${TYPICAL_RETURN.from * 100} to ${TYPICAL_RETURN.to * 100}%`}
        className="relative h-1 rounded-full bg-paper-2"
      >
        <span
          aria-hidden="true"
          className="absolute -inset-y-px rounded-[2px]"
          style={{
            left: on(TYPICAL_RETURN.from),
            width: `calc(${on(TYPICAL_RETURN.to)} - ${on(TYPICAL_RETURN.from)})`,
            background: "repeating-linear-gradient(135deg, var(--ink-muted) 0 1px, transparent 1px 5px)",
          }}
        />
        <span aria-hidden="true" className="absolute inset-y-0 left-0 rounded-full bg-pay-ink" style={{ width: `max(3px, ${on(share)})` }} />
      </div>
      <p aria-hidden="true" className="relative h-4 text-micro text-muted">
        <span className="absolute left-0 font-mono">0</span>
        {/* Under the band, from its start; on a phone ending at its end, so it never runs into the scale's last figure. */}
        <span
          className="absolute whitespace-nowrap max-sm:right-[calc(100%-var(--to))] sm:left-(--from)"
          style={{ "--from": on(TYPICAL_RETURN.from), "--to": on(TYPICAL_RETURN.to) } as CSSProperties}
        >
          Typical recall, {TYPICAL_RETURN.from * 100}–{TYPICAL_RETURN.to * 100}%
        </span>
        <span className="absolute right-0 font-mono">{RULER * 100}%</span>
      </p>
    </div>
  );
}

// The homepage's figures are set as the rest of its section sets them: regular weight, proportional figures (tabular
// ones space a stop or a colon like mono).
function Figure({ label, value, note, home }: { label: string; value: string; note?: string; home?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-ui text-muted">{label}</span>
      <span className={clsx("text-head-sm", !home && "font-medium")}>{value}</span>
      {note && (
        <span data-peek-hide className="text-ui text-muted">
          {note}
        </span>
      )}
    </div>
  );
}
