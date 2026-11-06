import { randomInt } from "node:crypto";

// No look-alikes (O 0 Q, I 1 L, 8 B, 5 S, 2 Z), so a hand-written code can't be misread.
const LETTERS = "ACDEFGHJKMNPRTUVWXY";
const DIGITS = "34679";

// Letter-digit-letter never spells a word, and the model always knows which slot holds a digit.
export const CODE_PATTERN = new RegExp(`^[${LETTERS}][${DIGITS}][${LETTERS}]$`);

const pick = (chars: string) => chars[randomInt(chars.length)];

export function newCode(): string {
  return pick(LETTERS) + pick(DIGITS) + pick(LETTERS);
}
