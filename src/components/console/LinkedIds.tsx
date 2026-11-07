"use client";

import { Fragment } from "react";

const ID = /(RM-\d{4})/;

/**
 * A sentence with every claim id in it ("…already has a claim for this recall (RM-2584)") as a button that opens that
 * claim in the same panel, so a reviewer never copies an id to search for it. The claim on screen (self) stays text.
 * Without onOpen (the homepage's still) it is the plain sentence.
 */
export function LinkedIds({ text, onOpen, self }: { text: string; onOpen?: (id: string) => void; self?: string }) {
  if (!onOpen || !ID.test(text)) return <>{text}</>;
  return (
    <>
      {text.split(ID).map((part, i) =>
        i % 2 === 0 || part === self ? (
          <Fragment key={i}>{part}</Fragment>
        ) : (
          <button
            key={i}
            type="button"
            onClick={() => onOpen(part)}
            className="font-mono whitespace-nowrap text-text underline decoration-line-strong underline-offset-2 hover:decoration-text"
          >
            {part}
          </button>
        ),
      )}
    </>
  );
}

/** The claim ids a sentence names, in order, once each. */
export const idsIn = (text: string) => [...new Set(text.match(/RM-\d{4}/g) ?? [])];
