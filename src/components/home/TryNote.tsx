import type { CSSProperties } from "react";

/**
 * Retired: the note under "Try a claim" is gone. Hero.tsx still imports this until the hero branch drops the import;
 * delete this file then.
 */
export function TryNote(props: { className?: string; style?: CSSProperties }) {
  void props;
  return null;
}
