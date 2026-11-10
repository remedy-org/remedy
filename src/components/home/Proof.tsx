import Image from "next/image";
import { Button } from "@/components/ui";
import { DEMO_SAMPLES, sampleLinkName } from "@/lib/demo/samples";
import { SAMPLE_COPY } from "@/lib/demo/sampleCopy";
import styles from "./landing.module.css";

const OUTCOMES = {
  genuine: { result: "Paid", reason: "All five checks pass", tone: "paid" },
  "wrong-code": { result: "Rejected", reason: "The tag’s code doesn’t match", tone: "rejected" },
  "ai-no-session": { result: "Blocked", reason: "Sent outside the camera session", tone: "blocked" },
  reposted: { result: "Blocked", reason: "Photo used in an earlier claim", tone: "blocked" },
} as const;

export function Proof() {
  return (
    <section id="proof" aria-labelledby="proof-title" className={`${styles.container} ${styles.proofSection}`}>
      <div className={styles.proofIntro}><div><p className={styles.kicker}><span />Try it for yourself</p><h2 id="proof-title" tabIndex={-1}>Four claims.<br />See what gets through.</h2></div><div><p>Try the same pipeline on four prepared photos. Follow the genuine claim to a PayPal sandbox payout, then inspect why the other cases stop.</p><p className={styles.proofNote}>Expected outcomes below. Your demo run shows its actual results.</p></div></div>
      <div className={styles.caseList}>{DEMO_SAMPLES.map((sample, index) => { const copy = SAMPLE_COPY[sample.id]; const outcome = OUTCOMES[sample.id]; return <a key={sample.id} href={`/r/kikea-x-vesolje/try?claim=${sampleLinkName(sample.id)}`} className={styles.caseRow}><span className={styles.caseNumber}>{String(index + 1).padStart(2, "0")}</span><Image src={sample.photos[0]} alt={copy.alt} width={80} height={64} sizes="80px" /><div className={styles.caseTitle}><h3>{copy.title}</h3><p>{outcome.reason}</p></div><span className={styles.previewStatus} data-tone={outcome.tone}><span aria-hidden="true">{outcome.tone === "paid" ? "✓" : "⊘"}</span>{outcome.result}</span><span className={styles.caseArrow} aria-hidden="true">↗</span></a>; })}</div>
      <div className={styles.evidenceNote}><span aria-hidden="true">ⓘ</span><div><h3>Evidence checks have limits.</h3><p>Clean generated images with the correct code can pass the visual check. Session timing, photo-reuse checks, and account limits add controls; they don’t prove that a camera took the image. Uncertain reads are held for a person.</p><details><summary>Read the evaluation notes <span aria-hidden="true">+</span></summary><p>The 9 November evaluation covered 97 cases, run three times each. All four prepared demo cases produced their intended outcomes in three of three runs. Two clean generated fakes passed the photo check in all six attempts. Real handwriting in phone photos has not yet been evaluated.</p><a href="https://github.com/remedy-org/remedy#evaluation" target="_blank" rel="noreferrer">Method, results, and limitations ↗</a></details></div></div>
      <div className={styles.proofCta}><Button href="/r/kikea-x-vesolje/try" prefetch={false} size="lg" arrow>Try all four claims</Button><span>PayPal sandbox · Prepared demo photos</span></div>
    </section>
  );
}
