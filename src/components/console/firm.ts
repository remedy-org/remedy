import type { Recall } from "@/lib/types";

// The firm a recall is filed under, and the signed-in company, compared loosely: "Kikea Store" and "KIKEA STORE INC."
// are one. Shared by the import (a recall CPSC files under another firm) and the console's workspace note.
const firmKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(?:inc|llc|ltd|co|corp|corporation|company|store|stores)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const sameFirm = (a: string, b: string) => {
  const [x, y] = [firmKey(a), firmKey(b)];
  return !x || !y || x.includes(y) || y.includes(x);
};

/** The firm CPSC's title names: "Kikea Store Recalls X-VESOLJE Nursing Pillows…" -> "Kikea Store". */
export const firmOf = (recall: Pick<Recall, "title">) => recall.title.match(/^(.+?) (?:Recalls?|Announces?) /)?.[1] ?? null;
