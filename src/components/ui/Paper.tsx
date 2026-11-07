import clsx from "clsx";
import type { CSSProperties, HTMLAttributes } from "react";

export type PaperVariant = "tag" | "sheet" | "receipt" | "notice";

export interface PaperProps extends HTMLAttributes<HTMLElement> {
  /**
   * tag: top corners cut, like a luggage tag. sheet: a verdict or document page. receipt: the refund slip.
   * notice: a document excerpt lying on the paper band (--band-sheet, a flat shadow), e.g. the recall notice on the
   * Problem band.
   */
  variant?: PaperVariant;
  /** A 10px punched hole, top centre, 14px from the top edge. The page shows through it. */
  hole?: boolean;
  /** A perforated top edge, torn from a roll. */
  perforated?: boolean;
  /** Resting tilt in degrees (DESIGN.md keeps it between -1.5 and 2). */
  tilt?: number;
  /** none for edge-to-edge content (a photo inside a tag); sm 12px; md 24px; lg 32px (24px on phones). */
  padding?: "none" | "sm" | "md" | "lg";
  as?: "div" | "figure" | "article" | "section" | "aside" | "li";
}

const pad = { none: "", sm: "p-3", md: "p-6", lg: "p-6 sm:p-8" };

/**
 * A paper object: the same material in both themes (paper background, ink text), radius 6, a hairline ring and one
 * soft shadow. The outer element takes layout classes and the tilt; the inner one is the paper itself.
 */
export function Paper({ variant = "sheet", hole, perforated, tilt, padding = "md", as: Tag = "div", className, style, children, ...rest }: PaperProps) {
  const cut = hole || perforated;
  // A mask or a clip-path also clips box-shadow, so cut paper casts its shadow from the wrapper instead.
  const lifted = variant !== "notice" && (cut || variant === "tag");
  const outerStyle: CSSProperties | undefined = tilt ? { ...style, rotate: `${tilt}deg` } : style;
  return (
    <Tag className={clsx("relative", lifted && "paper-lifted", className)} style={outerStyle} {...rest}>
      <div
        className={clsx(
          // On paper the focus ring is ink in both themes: amber on cream is 1.5:1.
          "relative h-full rounded-control text-ink [--focus:var(--ink)]",
          variant === "notice" ? "bg-band-sheet shadow-[var(--paper-shadow-flat)]" : "bg-paper",
          !lifted && variant !== "notice" && "shadow-paper",
          cut && "paper-cut",
          hole && "paper-hole",
          perforated && "paper-perforated",
          variant === "tag" && "paper-tag",
          pad[padding],
          // Clear the hole and the perforation bites.
          padding !== "none" && hole && "pt-11",
          padding !== "none" && !hole && perforated && "pt-8",
        )}
      >
        {children}
      </div>
    </Tag>
  );
}
