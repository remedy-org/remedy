import type { KeyboardEvent } from "react";

// Inside an explored exhibit (Enter on its panel), ↑ and ↓ move between its items, Home and End jump to the ends, and
// Tab still works. Without this the arrows scroll Studio's canvas under the page header instead.

const STEP: Record<string, number> = { ArrowUp: -1, ArrowDown: 1 };

/** The item an arrow, Home or End moves to from `at` in a list of `count`, or null for any other key. */
export function nextItem(key: string, at: number, count: number): number | null {
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (!(key in STEP)) return null;
  return Math.min(count - 1, Math.max(0, at + STEP[key]));
}

/** onKeyDown for a list widget's <ul> or <ol>: moves focus between its enabled buttons. */
export function moveBetweenItems(e: KeyboardEvent<HTMLElement>) {
  const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
  const at = items.indexOf(document.activeElement as HTMLButtonElement);
  const next = at < 0 ? null : nextItem(e.key, at, items.length);
  if (next === null) return;
  e.preventDefault();
  e.stopPropagation();
  items[next].focus();
}
