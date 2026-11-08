import clsx from "clsx";
import type { ReactNode } from "react";
import type { Report } from "@/app/console/_lib/report";
import { formatCents, formatMoney, percent } from "@/app/console/_lib/view";
import { ExhibitLabel, Meter, NoBreakHyphens, StatusPill } from "@/components/ui";
import type { Recall } from "@/lib/types";
import { formatCount, formatDate, formatDayET, plural } from "./format";

function H({ n, home, children }: { n: number; home?: boolean; children: ReactNode }) {
  return (
    <h2 className="flex items-baseline gap-3 text-body font-medium">
      {!home && <span className="font-mono text-micro text-muted">{String(n).padStart(2, "0")}</span>}
      {children}
    </h2>
  );
}

const TH = "py-2 pr-4 text-left font-mono text-micro font-medium uppercase tracking-[0.06em] text-muted last:pr-0";
// The homepage's sheet: sentence-case headers in the sans face, figures in tabular sans (mono stays for ids and codes).
const TH_HOME = "py-2 pr-4 text-left text-micro font-medium text-muted last:pr-0";
const td = "border-t border-line py-2.5 pr-4 align-top last:pr-0";

/** Shares of a total as whole percents that add up to 100 (largest remainder), so a column never totals 101%. */
export function wholeShares(counts: number[]): string[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return counts.map(() => "0%");
  const raw = counts.map((c) => (c / total) * 100);
  const floor = raw.map(Math.floor);
  let left = 100 - floor.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) if (left-- > 0) floor[i]++;
  return floor.map((n) => `${n}%`);
}

/** "5–8 Nov 2026", "30 Oct – 2 Nov 2026" or "5 Nov 2026": a claims period with the shared month and year said once. */
export function dayRange(fromIso: string, toIso: string) {
  const [a, b] = [formatDayET(fromIso), formatDayET(toIso)];
  if (a === b) return a;
  const [ad, am, ay] = a.split(" ");
  const [, bm, by] = b.split(" ");
  if (ay !== by) return `${a} – ${b}`;
  return am === bm ? `${ad}–${b}` : `${ad} ${am} – ${b}`;
}

// Where every claim in the totals came from, in Insights' words: the seeded samples, the judges' demo claims and the
// real owners' live claims, so the parts add up to the claim records the report is prepared from.
function provenance({ seeded, demo }: Pick<Report, "seeded" | "demo">, total: number) {
  const parts = [];
  const live = total - seeded - demo;
  if (seeded) parts.push(`${plural(seeded, "seeded sample claim")} (never paid to a real owner)`);
  if (demo) parts.push(`${plural(demo, "judges’ demo claim")} in sandbox money`);
  if (live) parts.push(`${plural(live, "live claim")} from ${live === 1 ? "a real owner" : "real owners"}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0];
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
  sandbox = false,
  home = false,
}: {
  recall: Recall;
  report: Report;
  generated: string;
  sandbox?: boolean;
  /**
   * The homepage's sheet, as a company would read it: "Draft" beside the title instead of a mono eyebrow, no section
   * numerals, sans figures, the claims period as one range, shares that add up to 100% and no hairline meter.
   */
  home?: boolean;
}) {
  const s = report.stats;
  const th = home ? TH_HOME : TH;
  const figure = home ? "tabular-nums" : "font-mono";
  const shares = home ? wholeShares(report.outcomes.map((o) => o.count)) : report.outcomes.map((o) => o.share);
  const period =
    report.firstClaim && report.lastClaim
      ? home
        ? dayRange(report.firstClaim, report.lastClaim)
        : `${formatDayET(report.firstClaim)} to ${formatDayET(report.lastClaim)}`
      : "No claims yet";
  const refused = s.rejected + s.blocked;
  const each = report.paidEachCents === null ? "" : ` at ${formatCents(report.paidEachCents)}`;
  const sampleNote = report.samplesPaid ? ` · ${formatCents(report.sampleCents)} sample, never sent` : "";
  return (
    // On screen it is a paper document, like every receipt, tag and notice (light-theme tokens inside, which pass on
    // --paper); printed, plain white.
    <article
      data-theme="light"
      className={clsx(
        "mx-auto w-full max-w-[52rem] rounded-card bg-paper px-6 text-text shadow-paper print:max-w-none print:rounded-none print:bg-white print:p-0 print:shadow-none",
        home ? "py-7 sm:px-10 sm:py-9" : "py-8 sm:px-12 sm:py-12",
      )}
    >
      <header className={clsx("flex flex-col gap-3 border-b border-line", home ? "pb-6" : "pb-8")}>
        {home ? (
          <p className="text-ui text-muted">Recall progress report</p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ExhibitLabel leader="none">Recall progress report · Draft</ExhibitLabel>
            <span className="font-mono text-micro text-muted">Generated {generated}</span>
          </div>
        )}
        <h1 className={clsx("font-medium text-balance", home ? "text-head-sm" : "text-h2")}>
          CPSC {recall.id}: <NoBreakHyphens>{recall.product}</NoBreakHyphens>
          {home && (
            <span className="ml-3 inline-flex h-6 translate-y-[-2px] items-center rounded-control border border-line-strong px-2 align-middle text-micro font-medium text-muted">
              Draft
            </span>
          )}
        </h1>
        <p className="text-ui text-muted">{recall.title}</p>
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-3 text-ui sm:grid-cols-4">
          {[
            ["Recall date", formatDate(recall.recallDate)],
            ["Remedy", "Refund for destroyed units"],
            ["Refund per unit", formatMoney(recall.refund)],
            ["Claims period (ET)", period],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-muted">{k}</dt>
              <dd className={clsx("mt-0.5", home && "sm:whitespace-nowrap")}>{v}</dd>
            </div>
          ))}
        </dl>
      </header>

      {(report.seeded > 0 || report.demo > 0) && (
        <p className="mt-8 rounded-control border border-line bg-surface-2 px-4 py-3 text-ui text-text">
          The {plural(s.total, "claim record")}: {provenance(report, s.total)}. Do not file these numbers with CPSC.
        </p>
      )}

      <section className="mt-8 flex flex-col gap-4 break-inside-avoid">
        <H n={1} home={home}>Units remedied</H>
        <div className="grid gap-6 sm:grid-cols-3">
          <Figure label="Units sold" value={s.unitsSold ? formatCount(s.unitsSold) : "Not given"} note={cpscUnits(recall, s.unitsSold)} />
          <Figure label="Units remedied" value={formatCount(s.remedied)} note={report.samplesPaid ? `Destroyed on camera; ${plural(report.samplesPaid, "sample")} never refunded` : "Destroyed on camera and refunded"} />
          <Figure label="Correction rate" value={percent(s.remedied, s.unitsSold)} note={`${formatCount(s.held)} more waiting for review`} />
        </div>
        {s.unitsSold > 0 && !home && <Meter value={s.remedied} max={s.unitsSold} label="Units remedied of units sold" />}
      </section>

      <section className="mt-10 flex flex-col gap-4 break-inside-avoid">
        <H n={2} home={home}>Claims by outcome</H>
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
                  <StatusPill status={o.decision} label={o.label} />
                  <span className="mt-1.5 block text-muted sm:hidden">{o.note}</span>
                </td>
                <td className={`${td} text-right ${figure}`}>{formatCount(o.count)}</td>
                <td className={`${td} text-right ${figure} text-muted`}>{shares[i]}</td>
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
        <H n={3} home={home}>Refunds paid</H>
        <div className="grid gap-6 sm:grid-cols-3">
          <Figure label={sandbox ? "Paid out (sandbox)" : "Paid out"} value={formatCents(report.sentCents)} note={`${plural(report.sent, "payout")}${report.sent ? each : ""}${sampleNote}`} />
          <Figure
            label={sandbox ? "Confirmed by PayPal (sandbox)" : "Confirmed by PayPal"}
            value={formatCents(report.settledCents)}
            note={report.settling ? `${formatCount(report.settling)} still settling` : report.sent ? "Every payout settled" : "No payouts sent yet"}
          />
          <Figure label="Method" value={sandbox ? "PayPal sandbox" : "PayPal"} note="Payouts to each owner's verified PayPal account" />
        </div>
      </section>

      <section className="mt-10 flex flex-col gap-4 break-inside-avoid">
        <H n={4} home={home}>Why claims were refused</H>
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
        <H n={5} home={home}>How units were verified</H>
        <p className="max-w-read text-ui text-text">
          Each owner logged in with PayPal, received a one-time code, and photographed the destroyed product with the code written on it, using a live camera
          session of 10 minutes with no upload option. Before any photo was examined, Remedy checked the session, refused reused photos and second claims
          from one account, and required a verified PayPal account. A vision model then described the label, the code and each destruction step, quoting
          what it saw; a fixed rule paid only when every answer passed, and held any unclear answer for a person.
        </p>
      </section>

      <footer className={clsx("mt-12 border-t border-line pt-4 text-micro text-muted", !home && "font-mono")}>
        Prepared by Remedy from {plural(s.total, "claim record")} on {generated}. Review before filing with CPSC.
      </footer>
    </article>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-ui text-muted">{label}</span>
      <span className="text-head-sm font-medium">{value}</span>
      {note && <span className="text-ui text-muted">{note}</span>}
    </div>
  );
}
