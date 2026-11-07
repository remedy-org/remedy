import clsx from "clsx";

export type MoneySize = "numeral" | "amount" | "inline" | "grid";

export interface MoneyProps {
  /** The amount in whole units, e.g. 29.99. */
  value: number;
  /** ISO currency code (default USD). */
  currency?: string;
  /**
   * numeral: the display size (56px at 1440), for the one figure per screen where the number is the point. amount:
   * 56px (40px on phones), the claim flow's refund. inline: the surrounding text's font and size. grid: 14px mono with
   * tabular figures, for tables.
   */
  size?: MoneySize;
  className?: string;
}

/** Splits a formatted amount into the whole part ("$1,234") and the cents (".50"). Exported for tests. */
export function splitMoney(value: number, currency = "USD") {
  const parts = new Intl.NumberFormat("en-US", { style: "currency", currency }).formatToParts(value);
  const at = parts.findIndex((p) => p.type === "decimal");
  const text = (list: Intl.NumberFormatPart[]) => list.map((p) => p.value).join("");
  // en-US puts the symbol first, so everything from the decimal point on is the cents.
  if (at < 0) return { whole: text(parts), cents: "", full: text(parts) };
  return { whole: text(parts.slice(0, at)), cents: text(parts.slice(at)), full: text(parts) };
}

const sizes: Record<MoneySize, { root: string; cents: string }> = {
  // Mercury's hero cents: 55%, top-aligned near the cap height.
  numeral: { root: "font-sans text-display font-medium", cents: "text-[0.55em] align-[0.62em] tracking-normal" },
  amount: { root: "font-sans text-amount font-medium", cents: "text-[0.55em] align-[0.62em] tracking-normal" },
  // Mercury's table cents: 73%, raised about 0.2em, and never under the 12px floor (73% of 14px would be 10.2px).
  inline: { root: "", cents: "relative -top-[0.2em] text-[length:max(12px,0.73em)]" },
  grid: { root: "font-mono text-ui tabular-nums", cents: "relative -top-[0.2em] text-[length:max(12px,0.73em)]" },
};

/**
 * An amount with de-emphasised cents: $29<sup-ish>.99</sup-ish>. Screen readers and copy-paste get the plain "$29.99":
 * the split parts are hidden from assistive tech, and the readable copy is excluded from text selection.
 */
export function Money({ value, currency = "USD", size = "inline", className }: MoneyProps) {
  const { whole, cents, full } = splitMoney(value, currency);
  const s = sizes[size];
  return (
    // No tabular-nums on the sans: Schibsted's tnum also makes the point tabular ("$29 .99"). Only grid (mono) has it.
    <span className={clsx("whitespace-nowrap", s.root, className)}>
      <span className="sr-only select-none">{full}</span>
      <span aria-hidden="true">
        {whole}
        {cents && <span className={clsx("cents", s.cents)}>{cents}</span>}
      </span>
    </span>
  );
}
