import { GridStill } from "@/components/console/GridStill";
import { previewProps } from "@/components/console/preview";
import { InsightsStill } from "@/components/insights/InsightsStill";
import { insightsPreview } from "@/components/insights/preview";
import { insightsStill } from "@/components/insights/still";
import { Button, Wordmark } from "@/components/ui";
import { QueueGlyph, InsightsGlyph } from "./glyphs";
import styles from "./landing.module.css";

export function Companies() {
  const grid = previewProps();
  const insights = insightsStill(insightsPreview());
  return (
    <section id="companies" aria-labelledby="companies-title" className={`${styles.container} ${styles.companySection}`}>
      <div className={styles.sectionHeading}><p className={styles.kicker}><span />For companies</p><h2 id="companies-title" tabIndex={-1}>The whole recall.<br />One clear workspace.</h2><p>Review claims, understand the evidence, and track progress without piecing the story together across tools.</p></div>
      <div className={styles.featureRow}>
        <div className={styles.featureCopy}><span className={styles.featureIcon}><QueueGlyph /></span><h3>Every claim comes<br />with its evidence.</h3><p>A queue you can work through. Open a claim to see its photos, the AI’s observations, and the exact check that decided it.</p><ul><li>Review uncertain claims in context</li><li>See payout status beside the decision</li><li>Search, filter, group, and export</li></ul><Button href="/signin" variant="tertiary" prefetch={false}>Open the company console</Button></div>
        <div className={styles.featureWindow}><div className={styles.featureBar}><Wordmark size="sm" /><span>Claims</span><span>Sample workspace</span></div><div className={styles.queueSummary}><h4>X-VESOLJE Nursing Pillows</h4><div><span><strong>{grid.rows.length}</strong> claims</span><span><strong>{grid.counts?.held}</strong> held for review</span><span><strong>{grid.ledger?.paidCents ? `$${(grid.ledger.paidCents / 100).toFixed(2)}` : "$0.00"}</strong> paid in this sample</span></div></div><div className={styles.companyGrid}><GridStill rows={grid.rows} flush /></div><div className={styles.previewCredit}><span>Claims powered by AG Grid</span><span>Illustrative workspace</span></div></div>
      </div>
      <div className={`${styles.featureRow} ${styles.reverseFeature}`}>
        <div className={`${styles.featureWindow} ${styles.insightsWindow}`}><div className={styles.featureBar}><Wordmark size="sm" /><span>Insights</span><span>Sample workspace</span></div><div className={styles.insightsBody}><InsightsStill data={insights} /></div><div className={styles.previewCredit}><span>Custom widgets powered by AG Studio</span><span>Same sample claims</span></div></div>
        <div className={styles.featureCopy}><span className={styles.featureIcon}><InsightsGlyph /></span><h3>See what’s resolved.<br />Understand what isn’t.</h3><p>Recall progress, refusal reasons, and PayPal payouts come from the same claims. Ask the Recall analyst to explain a claim or chart.</p><ul><li>Explore linked charts and custom widgets</li><li>Ask questions grounded in claim evidence</li><li>Prepare a CPSC progress-report draft</li></ul><p className={styles.analystBoundary}>The analyst can read, chart, and draft. It can’t approve a claim or move money.</p></div>
      </div>
      <div className={styles.companyCta}><div><h3>Start with the recall notice.</h3><p>Import a CPSC notice. Review the AI-drafted photo requirements. Publish a claim link for owners.</p></div><Button href="/signin" variant="secondary" prefetch={false} arrow>Run a recall on Remedy</Button></div>
      <p className={styles.companyDisclosure}>This build uses Remedy’s PayPal sandbox account. Per-company funding requires PayPal partner onboarding.</p>
    </section>
  );
}
