"use client";

import clsx from "clsx";
import { useEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { Button, CrossIcon, ThemeToggle, useTheme, Wordmark } from "@/components/ui";
import styles from "./home.module.css";
import { SCROLL_LOCK_EVENT } from "./SmoothScroll";

export interface NavMenuLink<Id extends string> {
  id: Id;
  label: string;
  /** One line under the label, in the sheet only. */
  note: string;
  /** "xl": in the bar from xl only (it is always in the sheet). */
  bar?: "xl";
}

const noop = () => () => {};
const lockScroll = (locked: boolean) => window.dispatchEvent(new CustomEvent(SCROLL_LOCK_EVENT, { detail: { locked } }));

// Menu and Close are the same word button, in the same spot: 36px, as "Try a claim" beside it, with a 44px hit
// area.
const wordButton =
  "relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-control border border-line-2 px-3 text-ui font-medium whitespace-nowrap text-text transition-colors duration-160 after:absolute after:-inset-x-px after:-inset-y-1.5 hover:bg-surface-2";

/**
 * Below lg the nav's links live behind a Menu word button that opens a full-screen sheet: a native modal <dialog>, as
 * JudgesSheet, so the top layer, the focus trap, Esc and the inert page come for free. The sheet repeats the 64px bar
 * (Close where Menu was), then the links with a line each, then the paths: a line for an owner with a real recall
 * (the claim link is on the company's notice), the amber "Try a claim" (the sheet covers the page,
 * so it is that screen's one amber), the companies' quiet sign-in, and the theme. Without JS, Menu is a link to the
 * footer's sitemap. The sheet renders into <body>, outside the header, so the header's scroll margin
 * (globals.css) stays off its rows.
 */
export function NavMenu<Id extends string>({ links, current, onPick }: { links: readonly NavMenuLink<Id>[]; current: Id | null; onPick: (id: Id) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const menu = useRef<HTMLButtonElement>(null);
  const closer = useRef<HTMLButtonElement>(null);
  // False when a link row closes the sheet: focus then goes to the section it jumped to, not back to Menu.
  const returnFocus = useRef(true);
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const theme = useTheme();

  const show = () => {
    const d = dialog.current;
    if (!d || d.open) return;
    returnFocus.current = true;
    d.showModal();
    closer.current?.focus({ preventScroll: true });
    // A sheet scrolled last time would reopen with its first rows under its own bar. Only an open dialog scrolls.
    d.scrollTop = 0;
    setOpen(true);
    lockScroll(true);
  };
  const close = () => dialog.current?.close();

  // A window that grows to lg shows the links in the bar, so the sheet goes. Leaving the page always unlocks Lenis.
  useEffect(() => {
    const lg = window.matchMedia("(min-width: 64rem)");
    const grow = () => lg.matches && dialog.current?.close();
    lg.addEventListener("change", grow);
    return () => {
      lg.removeEventListener("change", grow);
      lockScroll(false);
    };
  }, []);

  // An instant jump (never smooth: a smooth one would scrub the pinned sequence), once the sheet and its scroll lock
  // are gone. The same hash again does not scroll by itself, so that one is scrolled to.
  const choose = (e: MouseEvent<HTMLAnchorElement>, id: Id) => {
    e.preventDefault();
    returnFocus.current = false;
    lockScroll(false);
    dialog.current?.close();
    requestAnimationFrame(() => {
      const href = `#${id}`;
      if (window.location.hash === href) document.getElementById(id)?.scrollIntoView();
      else window.location.hash = href;
      onPick(id);
    });
  };

  const sheet = (
    // tabIndex -1: a scrolling sheet is otherwise a Tab stop of its own in Chromium. A click on its empty space closes
    // it, as a click on a sheet's backdrop would. scroll-pt-16: a focused row stops under the sheet's bar.
    <dialog
      ref={dialog}
      id="site-menu"
      aria-label="Menu"
      tabIndex={-1}
      data-lenis-prevent=""
      onClick={(e) => (e.target === dialog.current || (e.target as HTMLElement).hasAttribute("data-sheet-empty")) && close()}
      onClose={() => {
        setOpen(false);
        lockScroll(false);
        if (returnFocus.current) menu.current?.focus({ preventScroll: true });
      }}
      className={clsx(styles.sheet, "fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none scroll-pt-16 overflow-y-auto overscroll-contain border-0 bg-bg p-0 text-text outline-none")}
    >
      <div data-sheet-empty="" className="flex min-h-full flex-col">
        <div data-sheet-empty="" data-sheet-bar="" className="page sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 bg-bg sm:gap-4">
          <span aria-hidden="true">
            <Wordmark size="md" nameClassName="max-[359px]:sr-only" />
          </span>
          <button ref={closer} type="button" onClick={close} className={clsx(wordButton, "ml-auto")}>
            Close
            <CrossIcon />
          </button>
        </div>
        <div data-sheet-empty="" className="page flex flex-1 flex-col pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <ul className="divide-y divide-line">
            {links.map((l) => (
              <li key={l.id}>
                <a
                  href={`#${l.id}`}
                  onClick={(e) => choose(e, l.id)}
                  aria-current={current === l.id ? "location" : undefined}
                  className="-mx-3 flex min-h-16 flex-col justify-center rounded-control px-3 py-3 focus-visible:-outline-offset-2 aria-[current=location]:bg-surface-2"
                >
                  <span className="text-head-sm font-medium text-text">{l.label}</span>
                  <span className="text-ui text-pretty text-muted">{l.note}</span>
                </a>
              </li>
            ))}
          </ul>
          {/* Pinned to the foot on a tall screen; after the rows when there is no room (200% zoom). An owner with a real
              recall claims through the company's notice, so the demo is never mistaken for her claim. */}
          <div data-sheet-empty="" className="mt-auto flex flex-col pt-8">
            <p className="mb-4 max-w-[52ch] text-ui text-pretty text-muted">
              <span className="text-text">Own a recalled product?</span> Claim through the link or QR code on its recall notice.
            </p>
            <Button
              href="/r/kikea-x-vesolje/try"
              size="lg"
              block
              className="max-sm:h-auto max-sm:min-h-12 max-sm:px-3 max-sm:py-2.5 max-sm:text-center max-sm:text-balance max-sm:whitespace-normal"
            >
              Try a claim
            </Button>
            <Button href="/signin" variant="secondary" size="lg" block className="mt-4">
              Company sign in
            </Button>
          </div>
          {/* Below lg the bar keeps its room for the current section's name, so the theme toggle is here. */}
          <div className="mt-6 flex min-h-16 items-center justify-between border-t border-line">
            <span className="text-ui text-text">Appearance</span>
            <span className="flex items-center gap-3">
              <span className="text-ui text-muted">{theme === "light" ? "Light" : "Dark"}</span>
              <ThemeToggle />
            </span>
          </div>
        </div>
      </div>
    </dialog>
  );

  return (
    <>
      {mounted ? (
        <button ref={menu} type="button" onClick={show} aria-haspopup="dialog" aria-expanded={open} aria-controls="site-menu" className={clsx(wordButton, "lg:hidden")}>
          Menu
        </button>
      ) : (
        <a href="#footer-nav" className={clsx(wordButton, "lg:hidden")}>
          Menu
        </a>
      )}
      {mounted && createPortal(sheet, document.body)}
    </>
  );
}
