import clsx from "clsx";
import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { ArrowRightIcon } from "./icons";

export type ButtonVariant = "primary" | "secondary" | "tertiary";
export type ButtonSize = "sm" | "md" | "lg";

interface Common {
  /** primary = amber fill (one per view), secondary = the quiet button (surface-2, a hairline ring), tertiary = text with an arrow. */
  variant?: ButtonVariant;
  /** sm 36px (hit area stays 44px), md 44px, lg 48px. Tertiary ignores height. */
  size?: ButtonSize;
  /** Full width. */
  block?: boolean;
  /** Busy: disabled, aria-busy, and the label swaps to pendingLabel if given. */
  pending?: boolean;
  pendingLabel?: string;
  /** Tertiary shows a trailing arrow by default; pass false to hide it. */
  arrow?: boolean;
  className?: string;
  children: ReactNode;
}

type AsButton = Common & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className"> & { href?: undefined };
type AsLink = Common & Omit<ComponentProps<typeof Link>, "children" | "className"> & { href: string; disabled?: boolean };
export type ButtonProps = AsButton | AsLink;

const base =
  "group relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium " +
  "transition-[background-color,color,border-color,transform,opacity] duration-160 ease-snap " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "aria-disabled:pointer-events-none aria-disabled:opacity-40 disabled:pointer-events-none disabled:opacity-40";

const variants: Record<ButtonVariant, string> = {
  // A 0.5px white top edge: 8% would not show on amber.
  primary: "rounded-control bg-accent text-accent-ink shadow-[inset_0_0.5px_0_oklch(1_0_0/0.35)] hover:bg-accent-hover active:translate-y-px",
  secondary: "rounded-control bg-surface-2 text-text shadow-[inset_0_0_0_1px_var(--line-2),var(--bevel)] hover:bg-surface-3 active:translate-y-px",
  // A text link: the arrow moves on hover, the colour does not change.
  tertiary: "rounded-control text-text underline-offset-4 decoration-line-2 hover:underline",
};

const sizes: Record<ButtonSize, string> = {
  // after: keeps a 44px touch target around the 36px control.
  sm: "h-9 px-3 text-ui after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']",
  md: "h-11 px-4 text-ui",
  lg: "h-12 px-5 text-body",
};

const tertiarySizes: Record<ButtonSize, string> = {
  sm: "min-h-11 text-ui",
  md: "min-h-11 text-ui",
  lg: "min-h-11 text-body",
};

export function Button(props: ButtonProps) {
  const { variant = "primary", size = "md", block, pending, pendingLabel, arrow, className, children, ...rest } = props;
  const classes = clsx(base, variants[variant], variant === "tertiary" ? tertiarySizes[size] : sizes[size], block && "w-full", className);
  const showArrow = arrow ?? variant === "tertiary";
  const content = (
    <>
      <span>{pending && pendingLabel ? pendingLabel : children}</span>
      {showArrow && <ArrowRightIcon className="shrink-0 transition-transform duration-160 ease-snap group-hover:translate-x-[3px]" />}
    </>
  );

  if (rest.href !== undefined) {
    const { disabled, ...link } = rest as Omit<AsLink, keyof Common>;
    if (disabled || pending) {
      return (
        <span className={classes} role="link" aria-disabled="true" aria-busy={pending || undefined}>
          {content}
        </span>
      );
    }
    return (
      <Link className={classes} {...link}>
        {content}
      </Link>
    );
  }

  const { disabled, type = "button", ...button } = rest as Omit<AsButton, keyof Common>;
  return (
    <button className={classes} type={type} disabled={disabled || pending} aria-busy={pending || undefined} {...button}>
      {content}
    </button>
  );
}
