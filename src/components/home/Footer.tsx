import Link from "next/link";
import { Button, Wordmark } from "@/components/ui";
import styles from "./landing.module.css";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.finalCta}><div><p className={styles.kicker}><span />From evidence to resolution</p><h2>A recall is a promise.<br />Make good on it.</h2></div><div><Button href="/r/kikea-x-vesolje/try" prefetch={false} size="lg" arrow>Try a claim</Button><p>PayPal sandbox · Prepared demo photos</p></div></div>
        <div className={styles.footerMain}><div><Wordmark size="md" /><p>Recall evidence, clear decisions,<br />and refunds through PayPal.</p></div><nav id="footer-nav" aria-label="Footer"><div><h3>Product</h3><a href="#how">How it works</a><a href="#companies">For companies</a><a href="#proof">Evidence and limits</a></div><div><h3>Get started</h3><Link href="/r/kikea-x-vesolje/try" prefetch={false}>Try a claim</Link><Link href="/signin" prefetch={false}>Company login</Link><a href="https://github.com/remedy-org/remedy" target="_blank" rel="noreferrer">View the source ↗</a></div><div><h3>Information</h3><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><a href="https://paypalaihackathon.devpost.com/" target="_blank" rel="noreferrer">PayPal AI Hackathon ↗</a></div></nav></div>
        <div className={styles.footerBottom}><span>© 2026 Remedy</span><p>Built for the PayPal AI Hackathon with AG Grid and AG Studio.</p><span>Have a recalled product? Use the link on its recall notice.</span></div>
      </div>
    </footer>
  );
}
