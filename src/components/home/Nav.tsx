"use client";

import clsx from "clsx";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ThemeToggle, Wordmark } from "@/components/ui";
import { NavMenu, type NavMenuLink } from "./NavMenu";

type SectionId = "how" | "checks" | "proof" | "companies";

// In page order, in plain words. The problem (#problem) is left out: it does not fit at 1024px, and the footer's
// sitemap keeps it. While it is in view, no link is current.
const NAV_LINKS: readonly NavMenuLink<SectionId>[] = [
  { id: "how", label: "How it works", note: "One real claim, photo to PayPal payout" },
  { id: "checks", label: "Fraud checks", note: "Five checks. The first three need no AI" },
  { id: "proof", label: "Test results", note: "36 claims tested, 0 web photos paid" },
  { id: "companies", label: "For companies", note: "Every claim with its evidence, and the CPSC report" },
];

// The header's height, which html's scroll-padding-top matches (globals.css).
const HEADER = 64;
// What the spy watches, in page order: the hero's whole runway for How it works (its #how marker is a 0px span in the
// pinned form), and the problem, which maps to no link.
const SPIED = ["[data-spy=how]", "#problem", "#checks", "#proof", "#companies"];
const key = (el: Element) => el.getAttribute("data-spy") ?? el.id;

/**
 * "You are here": the section crossing a band from under the header to 35% down the viewport, the lowest one if two
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
      if (k === "how") next = (document.getElementById("how")?.getBoundingClientRect().top ?? Infinity) <= HEADER + 2 ? "how" : null;
      else next = k === "problem" ? null : (k as SectionId);
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
      { rootMargin: `-${HEADER}px 0px -65% 0px` },
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

  // After the jump: focus the target without scrolling (its heading, or the #how marker), so the next Tab goes on from
  // there; then, a frame later, measure where the page really is, as the observer may not have reported yet.
  const pick = useCallback(
    (id: SectionId) => {
      held.current = true;
      setCurrent(id);
      requestAnimationFrame(() => {
        document.getElementById(id === "how" ? "how" : `${id}-title`)?.focus({ preventScroll: true });
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
 * Whether an on-page "try" button ([data-try-cta]: the hero's, Checks' and the footer tag's) is at least half in view,
 * on phones only; null until known. From sm the bar's button always shows: the pinned hero's button never leaves the
 * viewport, it only fades, so watching it there would hide the bar's for the whole pin.
 */
function useTryInView() {
  const [inView, setInView] = useState<boolean | null>(null);
  useEffect(() => {
    const phone = window.matchMedia("(max-width: 39.99rem)");
    const seen = new Set<Element>();
    let io: IntersectionObserver | undefined;
    const watch = () => {
      io?.disconnect();
      seen.clear();
      if (!phone.matches) return setInView(false);
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.intersectionRatio >= 0.5) seen.add(e.target);
            else seen.delete(e.target);
          }
          setInView(seen.size > 0);
        },
        { threshold: 0.5, rootMargin: `-${HEADER}px 0px 0px 0px` },
      );
      document.querySelectorAll("[data-try-cta]").forEach((el) => io?.observe(el));
    };
    watch();
    phone.addEventListener("change", watch);
    return () => {
      phone.removeEventListener("change", watch);
      io?.disconnect();
    };
  }, []);
  return inView;
}

// The current link: --text on a --surface-2 chip, 32px tall in the 44px hit area and 10px wider on each side, so the
// row never reflows. Only its opacity moves, and it is never amber.
const linkClass = clsx(
  "relative isolate inline-flex min-h-11 items-center rounded-control text-ui whitespace-nowrap text-muted transition-colors duration-160 hover:text-text",
  "before:absolute before:inset-x-[-10px] before:inset-y-1.5 before:-z-10 before:rounded-control before:bg-surface-2 before:opacity-0 before:transition-opacity before:duration-160 before:ease-snap",
  "aria-[current=location]:text-text aria-[current=location]:before:opacity-100",
);

/**
 * The homepage nav on the page frame: the wordmark on the first grid line, a flat table of contents in plain words
 * beside it (the current one chipped), then the theme, a hairline, the companies' sign-in as quiet text and "Try the
 * demo" as the quiet button (the hero's amber "Try a claim with sample photos" is the screen's one action, and the
 * nav's never turns amber: below the hero, amber is already on almost every screen). Below lg a Menu sheet holds the
 * links; below sm the theme and sign-in move into it, and on phones "Try the demo" steps aside while an on-page try
 * button is in view.
 * No rule under it, a solid page tone (a translucent bar turned grey-brown over the cream paper band), and it never
 * hides: the pinned stage is laid out against a constant 64px header.
 */
export function Nav() {
  const { current, pick } = useNavSpy();
  const tryInView = useTryInView();
  return (
    <header data-home-nav="" className="sticky top-0 z-30 bg-bg">
      <nav aria-label="Main" data-current={current ?? undefined} className="page flex h-16 items-center gap-3 sm:gap-4">
        <Wordmark size="md" href="/" nameClassName="max-[359px]:sr-only" />
        <ul className="ml-6 hidden items-center gap-5 lg:flex xl:gap-7">
          {NAV_LINKS.map((l) => (
            <li key={l.id}>
              {/* A native, instant jump (Lenis leaves anchors alone): a smooth one would scrub the pinned sequence. */}
              <a href={`#${l.id}`} onClick={() => pick(l.id)} aria-current={current === l.id ? "location" : undefined} className={linkClass}>
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-3 sm:gap-5">
          <div className="hidden items-center sm:flex">
            <ThemeToggle />
            <span aria-hidden="true" className="mx-4 h-4 w-px bg-line-2" />
            <Link href="/signin" className="inline-flex min-h-11 items-center rounded-control text-ui whitespace-nowrap text-muted transition-colors duration-160 hover:text-text">
              Company sign in
            </Link>
          </div>
          {/* Hidden, not removed, so the bar never shifts; hidden also takes it out of the Tab order. Server-rendered
              hidden on phones until the observer says no try button is in view. */}
          <Button
            href="/r/kikea-x-vesolje/try"
            variant="secondary"
            size="sm"
            className={clsx("max-sm:transition-[background-color,color,transform,opacity,visibility]", tryInView !== false && "max-sm:invisible max-sm:opacity-0")}
          >
            Try the demo
          </Button>
          <NavMenu links={NAV_LINKS} current={current} onPick={pick} />
        </div>
      </nav>
    </header>
  );
}
