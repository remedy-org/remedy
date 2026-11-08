"use client";

import clsx from "clsx";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ThemeToggle, Wordmark } from "@/components/ui";
import { NavMenu, type NavMenuLink } from "./NavMenu";

type SectionId = "how" | "problem" | "checks" | "proof" | "companies";

// In page order, in plain words; each section's eyebrow says the same. Problem is in the sheet always, and in the bar
// from xl only: at 1024 the four others and the right side fill it.
const NAV_LINKS: readonly NavMenuLink<SectionId>[] = [
  { id: "how", label: "How it works", note: "One claim, photo to PayPal payout" },
  { id: "problem", label: "Problem", note: "Refunds run on an inbox of photos, and AI broke it", bar: "xl" },
  { id: "checks", label: "Fraud checks", note: "The five checks a fake has to beat, and four claims to try" },
  { id: "proof", label: "Results", note: "Every genuine claim paid, every stolen photo stopped" },
  { id: "companies", label: "For companies", note: "Every claim with its evidence, and the CPSC report" },
];

// The header's height, which html's scroll-padding-top matches (globals.css).
const HEADER = 64;
// What the spy watches, in page order: the hero's whole runway for How it works (its #how marker is a 0px span in the
// pinned form), then the four sections.
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
 * Whether an on-page "try" button ([data-try-cta]: the hero's, Checks' and the footer tag's) is at least half in view,
 * below lg only; null until known. From lg the bar's button always shows: the pinned hero's button never leaves the
 * viewport, it only fades, so watching it there would hide the bar's for the whole pin.
 */
function useTryInView() {
  const [inView, setInView] = useState<boolean | null>(null);
  useEffect(() => {
    const phone = window.matchMedia("(max-width: 63.99rem)");
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

// The link's box is the chip: 32px tall and 8px past the text each side (the negative margin keeps the row where it
// was), with a 44px hit area around it, so the focus ring and the current chip are one shape. The current link, and a
// link under the pointer or keyboard focus (the shared .nav-link behaviour, globals.css), is --text on --surface-2 (with
// the light theme's --line-2 hairline); only the chip's opacity moves, 120ms in, and it is never amber.
const linkClass = clsx(
  "relative isolate -mx-2 inline-flex h-8 items-center rounded-control px-2 text-ui whitespace-nowrap text-muted transition-colors duration-160 hover:text-text",
  "after:absolute after:inset-x-0 after:-inset-y-1.5",
  "before:absolute before:inset-0 before:-z-10 before:rounded-control before:bg-surface-2 before:shadow-(--nav-chip-ring) before:opacity-0 before:transition-opacity before:duration-160 before:ease-snap",
  "hover:before:opacity-100 hover:before:duration-120 focus-visible:text-text focus-visible:before:opacity-100",
  "aria-[current=location]:text-text aria-[current=location]:before:opacity-100",
);

/**
 * The homepage nav on the page frame: the wordmark on the first grid line, a flat table of contents in plain words
 * beside it (the current one chipped), then the theme, a hairline, the companies' sign-in as quiet text and "Try a
 * claim" as the quiet button: the same words as the hero's amber "Try a claim", the screen's one action (the nav's never turns amber: below the hero, amber is already on almost every screen). Below lg a Menu
 * sheet holds the links and the theme, and the bar names the current section where it has room; "Try a claim"
 * steps aside while an on-page try button is in view.
 * No rule under it, a solid page tone (a translucent bar turned grey-brown over the cream paper band), and it never
 * hides: the pinned stage is laid out against a constant 64px header.
 */
export function Nav() {
  const { current, pick } = useNavSpy();
  const tryInView = useTryInView();
  const here = NAV_LINKS.find((l) => l.id === current);
  return (
    <header data-home-nav="" className="sticky top-0 z-30 bg-bg">
      <nav aria-label="Main" data-current={current ?? undefined} className="page flex h-16 items-center gap-3 sm:gap-4">
        <Wordmark size="md" href="/" nameClassName="max-[359px]:sr-only" />
        <ul className="ml-6 hidden items-center gap-4 lg:flex xl:gap-7">
          {NAV_LINKS.map((l) => (
            <li key={l.id} className={clsx(l.bar === "xl" && "hidden xl:block")}>
              {/* A native, instant jump (Lenis leaves anchors alone): a smooth one would scrub the pinned sequence. */}
              <a href={`#${l.id}`} onClick={() => pick(l.id)} aria-current={current === l.id ? "location" : undefined} className={linkClass}>
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        {/* Below lg, where the links are in the sheet: the current section's name after a hairline, as a breadcrumb, from
            about 720px (the slot has to hold the longest name, or it shows none, so it never comes and goes by
            section). Text, not a chip, so it never reads as a button. Visual only; the sheet's rows carry aria-current. */}
        <div aria-hidden="true" className="@container hidden min-w-0 flex-1 sm:block lg:hidden">
          <span className={clsx("hidden items-center gap-3 text-ui whitespace-nowrap text-text-2 transition-opacity duration-160 ease-snap @min-[8rem]:flex", !here && "opacity-0")}>
            <span className="h-4 w-px bg-line-2" />
            {here?.label}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3 sm:gap-5">
          <div className="hidden items-center lg:flex">
            <ThemeToggle />
            <span aria-hidden="true" className="-mr-2 ml-3 h-4 w-px bg-line-2" />
          </div>
          {/* The shared nav link: the same chip on hover and focus, pulled out by its padding so the text stays put. */}
          <Link href="/signin" className="nav-link -mx-2.5 hidden sm:inline-flex">
            Sign in
          </Link>
          {/* Hidden, not removed, so the bar never shifts; hidden also takes it out of the Tab order. Server-rendered
              hidden below lg until the observer says no try button is in view. */}
          <Button
            href="/r/kikea-x-vesolje/try"
            variant="secondary"
            size="sm"
            className={clsx(
              "max-lg:transition-[background-color,color,transform,opacity,visibility]",
              tryInView !== false && "max-lg:invisible max-lg:opacity-0",
            )}
          >
            Try a claim
          </Button>
          <NavMenu links={NAV_LINKS} current={current} onPick={pick} />
        </div>
      </nav>
    </header>
  );
}
