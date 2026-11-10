"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Wordmark } from "@/components/ui";
import styles from "./landing.module.css";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#companies", label: "For companies" },
  { href: "#proof", label: "Evidence" },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const focusSection = (href: string) => {
    requestAnimationFrame(() => document.getElementById(`${href.slice(1)}-title`)?.focus({ preventScroll: true }));
  };
  const close = (href: string) => { setOpen(false); focusSection(href); };

  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
      if (event.key !== "Tab") return;
      const targets = menu.current?.querySelectorAll<HTMLElement>("a,button");
      const first = targets?.[0];
      const last = targets?.[targets.length - 1];
      if (event.shiftKey && document.activeElement === trigger.current) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); trigger.current?.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); trigger.current?.focus(); }
    };
    window.addEventListener("keydown", key);
    const resize = () => { if (window.innerWidth >= 900) setOpen(false); };
    window.addEventListener("resize", resize);
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("resize", resize); };
  }, [open]);

  return (
    <header className={styles.nav}>
      <div className={styles.navInner}>
        <Wordmark size="md" href="/" prefetch={false} />
        <nav aria-label="Main navigation" className={styles.desktopLinks}>
          {LINKS.map((link) => <a key={link.href} href={link.href} onClick={() => focusSection(link.href)}>{link.label}</a>)}
        </nav>
        <div className={styles.navActions}>
          <Link href="/signin" prefetch={false} className={styles.login}>Company login</Link>
          <Link href="/r/kikea-x-vesolje/try" prefetch={false} className={styles.navCta}>Try a claim <span aria-hidden="true">↗</span></Link>
          <button ref={trigger} className={styles.menuButton} aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">{open ? <path d="m5 5 10 10M15 5 5 15" /> : <path d="M3 5h14M3 10h14M3 15h14" />}</svg>
          </button>
        </div>
      </div>
      {open && <div ref={menu} id="mobile-navigation" className={styles.mobileMenu}>
        <nav aria-label="Mobile navigation">
          {LINKS.map((link) => <a key={link.href} href={link.href} onClick={() => close(link.href)}>{link.label}<span aria-hidden="true">↗</span></a>)}
          <Link href="/signin" prefetch={false} onClick={() => setOpen(false)}>Company login<span aria-hidden="true">↗</span></Link>
        </nav>
        <p>Own a recalled product? Use the claim link on its recall notice.</p>
      </div>}
    </header>
  );
}
