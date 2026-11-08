"use client";

import { Fragment } from "react";

// A claim id, with the brackets around it when it has them, so "(RM-7306)" never breaks across lines; or a claim code
// ("K7Q", "K7O"), three letters and digits with at least one of each.
const TOKEN = /(\(RM-\d{4}\)|RM-\d{4}|\b[A-Z0-9]{3}\b)/;
const isCode = (t: string) => /^[A-Z0-9]{3}$/.test(t) && /\d/.test(t) && /[A-Z]/.test(t);

/**
 * A sentence with its claim ids and codes in mono, as everywhere else in the product: the reason a claim was refused
 * often turns on O against Q, which the sans face barely tells apart. With onOpen, every claim id in it ("…already has a
 * claim for this recall (RM-2584)") is a button that opens that claim in the same panel, so a reviewer never copies an
 * id to search for it. The claim on screen (self) stays text.
 */
export function LinkedIds({ text, onOpen, self }: { text: string; onOpen?: (id: string) => void; self?: string }) {
  return (
    <>
      {text.split(TOKEN).map((part, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
        if (isCode(part)) {
          return (
            <span key={i} className="font-mono whitespace-nowrap">
              {part}
            </span>
          );
        }
        const id = part.replace(/[()]/g, "");
        if (!id.startsWith("RM-")) return <Fragment key={i}>{part}</Fragment>;
        const [open, close] = part.startsWith("(") ? ["(", ")"] : ["", ""];
        return (
          <span key={i} className="whitespace-nowrap">
            {open}
            {onOpen && id !== self ? (
              <button
                type="button"
                onClick={() => onOpen(id)}
                className="font-mono text-text underline decoration-line-strong underline-offset-2 hover:decoration-text"
              >
                {id}
              </button>
            ) : (
              <span className="font-mono">{id}</span>
            )}
            {close}
          </span>
        );
      })}
    </>
  );
}

/** The claim ids a sentence names, in order, once each. */
export const idsIn = (text: string) => [...new Set(text.match(/RM-\d{4}/g) ?? [])];
