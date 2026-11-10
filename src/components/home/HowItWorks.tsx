import { ArrowRightIcon, CheckIcon } from "@/components/ui";
import { DEMO_SPEC } from "@/lib/demo/kikea";
import styles from "./landing.module.css";

const STEPS = [
  { n: "01", name: "Capture the evidence", description: "The owner signs in with PayPal, writes their one-time code, and photographs the destroyed product in the claim’s camera.", detail: "One link. Clear instructions." },
  { n: "02", name: "Check the claim", description: "Session, reuse, and account checks run first. AI reads the photo; fixed rules pass it, reject it, or hold it for a person.", detail: "Every decision has a reason." },
  { n: "03", name: "Send the refund", description: "Eligible claims are paid through PayPal Payouts. The owner gets a receipt, and the company gets a traceable payment status.", detail: "From evidence to resolution." },
];

export function HowItWorks() {
  return (
    <>
      <section id="how" aria-labelledby="how-title" className={`${styles.container} ${styles.howSection}`}>
        <div className={styles.sectionHeading}><p className={styles.kicker}><span />How it works</p><h2 id="how-title" tabIndex={-1}>A shorter path<br />from recall to refund.</h2><p>One connected flow for the owner who needs a refund and the team responsible for getting it right.</p></div>
        <ol className={styles.steps}>{STEPS.map((step, index) => <li key={step.n}><div className={styles.stepTop}><span>{step.n}</span>{index < 2 && <ArrowRightIcon size={20} />}</div><h3>{step.name}</h3><p>{step.description}</p><div className={styles.stepDetail}><CheckIcon size={14} />{step.detail}</div></li>)}</ol>
      </section>
      <section className={`${styles.container} ${styles.problemSection}`} aria-labelledby="problem-title">
        <div className={styles.problemCopy}><p className={styles.kicker}><span />Built for a real operational problem</p><h2 id="problem-title">A safety recall<br />shouldn’t get stuck<br />in someone’s inbox.</h2><p>For smaller sellers, a refund recall can mean an inbox full of destruction photos. Someone has to read every message, inspect every image, and arrange every payment.</p><p>Remedy brings those steps together, with the evidence beside the decision and a person in the loop when it’s unclear.</p></div>
        <div className={styles.noticeCard}><div className={styles.noticeTop}><span>CPSC RECALL NOTICE</span><span>27-071</span></div><span className={styles.noticeLabel}>THE CURRENT PROCESS</span><h3>Destroy the product.<br />Email a photograph.<br />Wait for a refund.</h3><p>The public X-VESOLJE nursing pillow recall asks owners to destroy the pillow and email a photograph to receive a refund.</p><a href={DEMO_SPEC.source} target="_blank" rel="noreferrer">Read the original CPSC notice <span aria-hidden="true">↗</span></a><p className={styles.noticeDisclaimer}>This public recall is our demonstration case. Kikea Store is not a Remedy customer.</p></div>
      </section>
    </>
  );
}
