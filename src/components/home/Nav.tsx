"use client";

import clsx from "clsx";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Wordmark } from "@/components/ui";
import { NavMenu, type NavMenuLink } from "./NavMenu";
import styles from "./nav.module.css";

type SectionId = "how" | "problem" | "checks" | "proof" | "companies";

// In page order, in plain words; each section's eyebrow says the same. Why recalls stall is in the sheet always, and in the bar
// from xl only: at 1024 the four others and the right side fill it.
const NAV_LINKS: readonly NavMenuLink<SectionId>[] = [
  { id: "how", label: "How it works", note: "One claim, photo to PayPal payout" },
  { id: "problem", label: "Why recalls stall", note: "Why recall refunds stay stuck, and where Remedy cuts the loop", bar: "xl" },
  { id: "checks", label: "Fraud checks", note: "The five checks a fake has to beat, and four claims to try" },
  { id: "proof", label: "Results", note: "Every genuine claim paid, every stolen photo stopped" },
  { id: "companies", label: "For companies", note: "Every claim with its evidence, and the CPSC report" },
];

// The header's height, which html's scroll-padding-top matches (globals.css).
const HEADER = 72;
// What the spy watches, in page order: the hero's whole runway for How it works (its #how marker is a 0px span in the
// pinned form), then the four sections.
const SPIED = ["[data-spy=how]", "#problem", "#checks", "#proof", "#companies"];
const key = (el: Element) => el.getAttribute("data-spy") ?? el.id;

/**
 * "You are here": the section crossing a band from under the header to half way down the viewport (so Fraud checks
 * takes the chip as it covers half the Problem sheet), the lowest one if two
 * do. How it works counts only once the #how marker has passed under the header, so the hero at rest shows no chip.
 * A click takes the chip at once and holds it through the jump, so it never flashes through the sections in between.
 */
function useNavSpy() {
  const [current, setCurrent] = useState<SectionId | null>(null);
  const held = useRef(false);
  const els = useRef<Element[]>([]);
  const inBand = useRef(new Set<string>());

  const apply = useCallback(() => {
    if (held.current) return;
    let next: SectionId | null = null;
    for (const el of els.current) {
      const k = key(el);
      if (!inBand.current.has(k)) continue;
      next = k !== "how" || (document.getElementById("how")?.getBoundingClientRect().top ?? Infinity) <= HEADER + 2 ? (k as SectionId) : null;
    }
    setCurrent(next);
  }, []);

  useEffect(() => {
    els.current = SPIED.flatMap((s) => document.querySelector(s) ?? []);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) inBand.current.add(key(e.target));
          else inBand.current.delete(key(e.target));
        }
        apply();
      },
      { rootMargin: `-${HEADER}px 0px -50% 0px` },
    );
    els.current.forEach((el) => io.observe(el));
    // Inside the runway the observer has nothing new to say; the scroll decides when #how has passed.
    let raf = 0;
    const onScroll = () => {
      if (raf || !inBand.current.has("how")) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        apply();
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [apply]);

  // After the jump: focus the target without scrolling, so the next Tab goes on from there: the section's heading, or
  // How it works' own heading where it is on screen (the static figures), else the #how marker (the pinned and phone
  // forms, whose heading is for screen readers only). A keyboard user sees the ring on it. Then, a frame later, measure
  // where the page really is, as the observer may not have reported yet.
  const pick = useCallback(
    (id: SectionId) => {
      held.current = true;
      setCurrent(id);
      requestAnimationFrame(() => {
        const heading = document.getElementById(`${id}-title`);
        const shown = heading && heading.getBoundingClientRect().height > 1;
        (id === "how" && !shown ? document.getElementById("how") : heading)?.focus({ preventScroll: true });
        requestAnimationFrame(() => {
          const bottom = window.innerHeight * 0.35;
          inBand.current = new Set(
            els.current.filter((el) => {
              const r = el.getBoundingClientRect();
              return r.top < bottom && r.bottom > HEADER;
            }).map(key),
          );
          held.current = false;
          apply();
        });
      });
    },
    [apply],
  );

  return { current, pick };
}

/**
 * A native jump to a section (the bar's, the sheet's, the footer's, the hero's) adds a history entry the router did not
 * write, and the router ignores Back to such an entry: Back from /signin left the sign-in page on screen under
 * "/#companies". Once the jump has landed, the entry is written again through the router (its documented
 * replaceState), without the hash: Back then renders the homepage where the reader left it, not at the section's top.
 */
function useRouterOwnsHashJumps() {
  useEffect(() => {
    const own = () => {
      if (!window.history.state?.__NA) window.history.replaceState(null, "", window.location.pathname + window.location.search);
    };
    window.addEventListener("hashchange", own);
    return () => window.removeEventListener("hashchange", own);
  }, []);
}

/** The fixed-height bar stays quiet while the product story moves underneath it. */
export function Nav() {
  const { current, pick } = useNavSpy();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const read = () => setScrolled(window.scrollY > 12);
    read();
    window.addEventListener("scroll", read, { passive: true });
    return () => window.removeEventListener("scroll", read);
  }, []);
  useRouterOwnsHashJumps();
  return (
    <header data-home-nav="" data-scrolled={scrolled || undefined} className={styles.header}>
      <nav aria-label="Main" data-current={current ?? undefined} className={styles.bar}>
        <Wordmark size="md" href="/" className={styles.wordmark} />
        <ul className={styles.links}>
          {NAV_LINKS.map((l) => (
            <li key={l.id} className={clsx(l.bar === "xl" && styles.wideLink)}>
              {/* A native, instant jump (Lenis leaves anchors alone): a smooth one would scrub the pinned sequence. */}
              <a href={`#${l.id}`} onClick={() => pick(l.id)} aria-current={current === l.id ? "location" : undefined} className={styles.sectionLink}>
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className={styles.actions}>
          <a href="https://github.com/remedy-org/remedy" target="_blank" rel="noopener noreferrer" aria-label="View Remedy source on GitHub (opens in a new tab)" title="View source on GitHub" className={styles.source}>
            <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18" />
            </svg>
          </a>
          <Link href="/signin" className={styles.login}>Log in</Link>
          <Link href="/r/kikea-x-vesolje/try" className={styles.claim}>
            Try a claim
          </Link>
          <NavMenu links={NAV_LINKS} current={current} onPick={pick} />
        </div>
      </nav>
    </header>
  );
}
