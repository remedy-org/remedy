import { describe, expect, it, vi } from "vitest";
import { DEMO_CLAIMS } from "./demo/claims";
import { MONEY_WORD, moneyCents, moneyCounts, type MoneyState } from "./payoutWords";
import type { Claim } from "./types";

vi.mock("server-only", () => ({}));

const { demoDataset } = await import("./demo/dataset");
const { summarize } = await import("./store/store");
const { toRow, ledgerOf } = await import("@/app/console/_lib/view");
const { buildReport } = await import("@/app/console/_lib/report");
const { buildInsights } = await import("@/app/console/insights/facts");
const { insightsStill } = await import("@/components/insights/still");
const { previewProps } = await import("@/components/console/preview");
const { verdictOf, verdictWord } = await import("@/components/console/VerdictMark");
const { TABS } = await import("@/components/console/StatusTabs");

// One payout vocabulary on every surface: Paid (PayPal confirmed), Sent, settling (sent, not confirmed), Approved (the
// rule or a person approved, nothing sent). The totals are computed from the dataset (lib/demo/claims.ts) and every
// surface must give the same ones: the queue's tabs, header and footer, Insights' legend and funnel, the CPSC report,
// the CSV, the homepage tour and /signin.

const STATES: MoneyState[] = ["paid", "settling", "approved"];
const WORDS = STATES.map((s) => MONEY_WORD[s]);
const tally = (words: string[]) => Object.fromEntries(WORDS.map((w) => [w, words.filter((x) => x === w).length]));

/** Every surface's counts and money for these claims. */
function surfaces(claims: Claim[]) {
  const { recall } = demoDataset();
  const rows = claims.map((c) => toRow(summarize(c), recall));
  const report = buildReport(claims.map(summarize), recall);
  const insights = buildInsights(claims, recall, new Date("2026-11-08T09:00:00Z"));
  const tabs = Object.fromEntries(TABS.filter((t) => t.id !== "all").map((t) => [t.label, rows.filter((r) => verdictOf(r) === t.id).length]));
  return {
    tabs: tally(Object.entries(tabs).flatMap(([w, n]) => Array<string>(n).fill(w))),
    rows: tally(rows.map((r) => verdictWord(verdictOf(r)))),
    csv: tally(rows.map((r) => verdictWord(verdictOf(r)))),
    report: tally(report.outcomes.flatMap((o) => Array<string>(o.count).fill(o.label))),
    insights: tally(insights.claims.map((c) => c.decision)),
    footer: moneyCents(rows),
    ledger: ledgerOf(rows, recall),
    funnelPaid: insightsStill(insights).totals.paid,
    remedied: report.stats.remedied,
  };
}

describe("the payout vocabulary", () => {
  const { claims } = demoDataset();
  const expected = {
    [MONEY_WORD.paid]: DEMO_CLAIMS.filter((d) => d.outcome === "paid").length,
    [MONEY_WORD.settling]: 0,
    [MONEY_WORD.approved]: DEMO_CLAIMS.filter((d) => d.outcome === "approved").length,
  };

  it("counts the dataset as Paid 1, Sent, settling 0, Approved 1", () => {
    expect(expected).toEqual({ Paid: 1, "Sent, settling": 0, Approved: 1 });
    expect(moneyCounts(claims.map((c) => ({ decision: c.decision, payoutStatus: c.payout?.status ?? null })))).toEqual({ paid: 1, settling: 0, approved: 1 });
  });

  it("gives every console surface the dataset's numbers", () => {
    const s = surfaces(claims);
    for (const surface of [s.tabs, s.rows, s.csv, s.report, s.insights]) expect(surface).toEqual(expected);
    // Paid money is only what PayPal confirmed; the footer's states add up to everything approved.
    expect(s.footer).toEqual({ paid: 2999, settling: 0, approved: 2999 });
    expect(s.ledger.paidCents).toBe(s.footer.paid);
    expect(s.ledger.remedied).toBe(1 + 0 + 1);
    expect(s.remedied).toBe(s.ledger.remedied);
    expect(s.funnelPaid).toBe(expected.Paid);
  });

  it("gives the homepage tour and /signin the same counts", () => {
    for (const { counts } of [previewProps(), previewProps(456, { asConsole: true })]) {
      expect({ Paid: counts!.paid, "Sent, settling": counts!.settling, Approved: counts!.approved }).toEqual(expected);
    }
  });

  it("says Sent, settling everywhere for a payout PayPal hasn't confirmed", () => {
    // RM-0442's payout as it was before PayPal confirmed it.
    const sent = claims.map((c) => (c.payout ? { ...c, payout: { ...c.payout, status: "PENDING" } } : c));
    const s = surfaces(sent);
    const settling = { Paid: 0, "Sent, settling": 1, Approved: 1 };
    for (const surface of [s.tabs, s.rows, s.csv, s.report, s.insights]) expect(surface).toEqual(settling);
    expect(s.footer).toEqual({ paid: 0, settling: 2999, approved: 2999 });
    expect(s.ledger.paidCents).toBe(0);
    expect(s.funnelPaid).toBe(0);
  });
});
