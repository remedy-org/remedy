import { previewProps } from "@/components/console/preview";
import { Button } from "@/components/ui";
import { ProductShowcase } from "./ProductShowcase";
import styles from "./landing.module.css";

export function Hero() {
  const { rows } = previewProps();
  return (
    <section aria-labelledby="hero-title" className={styles.hero}>
      <div className={`${styles.container} ${styles.heroIntro}`}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}><span />A better way to resolve a recall</p>
          <h1 id="hero-title">Recall refunds,<br />without the inbox.</h1>
          <p className={styles.heroLead}>Owners submit destruction photos. Remedy checks the evidence, routes uncertain claims for review, and pays eligible refunds through PayPal.</p>
          <div className={styles.heroActions}>
            <Button href="/r/kikea-x-vesolje/try" prefetch={false} size="lg" arrow>Try a claim</Button>
            <a href="#companies" className={styles.textLink}>Explore the console <span aria-hidden="true">↗</span></a>
          </div>
          <p className={styles.demoNote}>PayPal sandbox <span aria-hidden="true">·</span> Prepared demo photos</p>
        </div>
        <aside className={styles.heroAside} aria-label="The Remedy workflow">
          <p>One recall.<br />Every step connected.</p>
          <a href="#how"><span>01</span> Evidence from owners <span aria-hidden="true">↗</span></a>
          <a href="#companies"><span>02</span> Decisions you can inspect <span aria-hidden="true">↗</span></a>
          <a href="#proof"><span>03</span> Refunds through PayPal <span aria-hidden="true">↗</span></a>
        </aside>
      </div>
      <div className={styles.container}><ProductShowcase rows={rows} /></div>
      <div className={`${styles.container} ${styles.integrationLine}`}><span>From a CPSC notice to a resolved claim.</span><div><span>PayPal</span><i /> <span>OpenAI</span><i /><span>AG Grid</span><i /><span>AG Studio</span></div></div>
    </section>
  );
}
