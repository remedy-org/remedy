import clsx from "clsx";
import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { ArrowRightIcon } from "./icons";

export type ButtonVariant = "primary" | "secondary" | "tertiary";
export type ButtonSize = "sm" | "md" | "lg";

interface Common {
  /** primary = brass fill (one per view), secondary = the quiet button (a raised key, a hairline ring), tertiary = text with an arrow. */
  variant?: ButtonVariant;
  /** sm 36px (hit area stays 44px), md 44px, lg 48px; the radius is 8px, 8px and 10px. Tertiary ignores height. */
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
  "transition-[background-color,color,box-shadow,scale,opacity] duration-160 ease-snap " +
  "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus " +
  "aria-disabled:pointer-events-none aria-disabled:opacity-40 disabled:pointer-events-none disabled:opacity-40";

// The fills, rims, hover sheen and press live in globals.css (.btn-primary, .btn-quiet): their shadow stacks differ by
// theme. A press scales the button to 98% (96% at 36px) and deepens it, in 75ms.
const variants: Record<ButtonVariant, string> = {
  primary: "btn-primary active:duration-75",
  secondary: "btn-quiet active:duration-75",
  // A text link: the arrow moves on hover, the colour does not change.
  tertiary: "rounded-control text-text underline-offset-4 decoration-line-2 hover:underline",
};

const sizes: Record<ButtonSize, string> = {
  // after: keeps a 44px touch target around the 36px control.
  sm: "h-9 rounded-button px-3.5 text-ui active:scale-[0.96] after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']",
  md: "h-11 rounded-button px-4.5 text-ui",
  lg: "h-12 rounded-button-lg px-6 text-body tracking-[-0.005em]",
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
