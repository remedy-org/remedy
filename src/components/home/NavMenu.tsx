"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { CrossIcon, Wordmark } from "@/components/ui";
import styles from "./nav.module.css";
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

/** Native modal behavior keeps the background inert and traps focus until the reader closes the menu. */
export function NavMenu<Id extends string>({ links, current, onPick }: { links: readonly NavMenuLink<Id>[]; current: Id | null; onPick: (id: Id) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const menu = useRef<HTMLButtonElement>(null);
  const closer = useRef<HTMLButtonElement>(null);
  // False when a link row closes the sheet: focus then goes to the section it jumped to, not back to Menu.
  const returnFocus = useRef(true);
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(noop, () => true, () => false);

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
    // tabIndex -1 keeps Chromium from adding the scrolling dialog itself to the Tab order.
    <dialog
      ref={dialog}
      id="site-menu"
      aria-label="Menu"
      tabIndex={-1}
      data-lenis-prevent=""
      onClose={() => {
        setOpen(false);
        lockScroll(false);
        if (returnFocus.current) menu.current?.focus({ preventScroll: true });
      }}
      className={styles.sheet}
    >
      <div className={styles.sheetContent}>
        <div data-sheet-bar="" className={styles.sheetBar}>
          <span aria-hidden="true">
            <Wordmark size="md" className={styles.wordmark} />
          </span>
          <button ref={closer} type="button" onClick={close} aria-label="Close navigation menu" className={styles.menuButton}>
            <CrossIcon className="size-5" />
          </button>
        </div>
        <div className={styles.sheetMain}>
          <ul className={styles.sheetLinks}>
            {links.map((l) => (
              <li key={l.id}>
                <a
                  href={`#${l.id}`}
                  onClick={(e) => choose(e, l.id)}
                  aria-current={current === l.id ? "location" : undefined}
                  className={styles.sheetLink}
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className={styles.sheetFoot}>
            <p className={styles.sheetNote}>
              Own a recalled product? Use the link or QR code on its recall notice. Explore a sample claim below.
            </p>
            <Link href="/signin" className={styles.sheetLogin}>Company log in</Link>
            <Link href="/r/kikea-x-vesolje/try" className={styles.sheetClaim}>Try a claim</Link>
          </div>
        </div>
      </div>
    </dialog>
  );

  return (
    <>
      {mounted ? (
        <button ref={menu} type="button" onClick={show} aria-label="Open navigation menu" aria-haspopup="dialog" aria-expanded={open} aria-controls="site-menu" className={styles.menuButton}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" focusable="false"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
        </button>
      ) : (
        <a href="#footer-nav" className={styles.menuButton}>
          Menu
        </a>
      )}
      {mounted && createPortal(sheet, document.body)}
    </>
  );
}
