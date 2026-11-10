import clsx from "clsx";
import type { CSSProperties, ReactNode } from "react";
import { formatCents } from "@/app/console/_lib/view";
import { formatCount } from "@/components/console/format";
import { insightsLedger } from "./report";
import type { InsightsStillData } from "./still";
import { DecisionMixView } from "./widgets/DecisionMixView";
import styles from "./home-insights.module.css";

const STAGE_LABEL = {
  Filed: "Claims filed",
  "Photos sent": "Photos received",
  "Passed the account checks": "Pre-AI checks passed",
  "Passed photo check": "Photo checks passed",
  Paid: "Paid by PayPal",
};

/** A marketing summary of the same claim facts; the full application report keeps every panel and filter. */
export function HomeInsights({ data, rail, phone = false }: { data: InsightsStillData; rail?: ReactNode; phone?: boolean }) {
  const ledger = insightsLedger(data.insights.claims);
  const filed = data.steps[0]?.reached ?? 0;
  const beforeModel = data.insights.claims.filter((c) => c.refused && c.refusalGate === "No AI").length;

  return (
    <div data-still data-home-insights role="region" aria-label="Illustrative recall insights" tabIndex={phone ? undefined : 0} className={clsx(styles.root, phone ? styles.phone : styles.frame)}>
      <div className={styles.content}>
        <div className={styles.dashboard}>
          <dl className={styles.summary}>
            <div><dt>Prepared claims</dt><dd>{formatCount(data.totals.claims)}</dd></div>
            <div><dt>Paid through PayPal</dt><dd className={styles.paid}>{formatCents(ledger.paidCents)}</dd></div>
            <div><dt>Held for a person</dt><dd>{formatCount(data.totals.held)}</dd></div>
          </dl>

          <div className={styles.panels}>
            <section className={styles.panel}>
              <h3>Every claim has an outcome.</h3>
              {data.decisions.length ? <DecisionMixView items={data.decisions} /> : <p className={styles.note}>No claims have been filed yet.</p>}
              <p className={styles.note}>
                {ledger.refused > 0
                  ? <>{formatCount(beforeModel)} of {formatCount(ledger.refused)} refusals stopped before the AI photo check.</>
                  : "The session, duplicate-photo and account checks run before the AI photo check."}
              </p>
            </section>

            <section className={styles.panel}>
              <h3>See where claims stop.</h3>
              <ol className={styles.progress} aria-label="Claim progression">
                {data.steps.map((step, i) => (
                  <li key={step.stage}>
                    <div className={styles.stageLabel}>
                      <span>{STAGE_LABEL[step.stage]}</span>
                      <span className={styles.count}>{formatCount(step.reached)}</span>
                    </div>
                    <span className={styles.track} aria-hidden="true">
                      <span
                        data-bar="funnel"
                        className={clsx(styles.fill, step.stage === "Paid" && styles.paidFill)}
                        style={{ width: `${filed > 0 ? (step.reached / filed) * 100 : 0}%`, "--i": i } as CSSProperties}
                      />
                    </span>
                  </li>
                ))}
              </ol>
              <p className={styles.note}>Paid means PayPal confirmed the payout. Held claims wait for a person.</p>
            </section>
          </div>

          <p className={styles.scope}>
            Illustrative workspace · {formatCount(data.totals.claims)} prepared claims · recall size {formatCount(data.progress.total)} units · day {formatCount(data.progress.dayCount)}.
          </p>
        </div>
        {rail && <aside className={styles.rail}>{rail}</aside>}
      </div>
    </div>
  );
}
