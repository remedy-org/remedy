import clsx from "clsx";
import Link from "next/link";

export interface WordmarkProps {
  /** sm for app chrome (16px type), md for the homepage nav (20px). */
  size?: "sm" | "md";
  /** Wrap in a link, usually "/". */
  href?: string;
  className?: string;
}

// The mark is an evidence tag: a notched card with its string hole, in amber.
function Mark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" focusable="false" className="shrink-0">
      <path d="M6 2.5h8.5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6L2.5 13.5v-7z" fill="var(--accent)" />
      <circle cx="7" cy="10" r="1.6" fill="var(--bg)" />
      <path d="M10.5 7.5h3M10.5 10h3M10.5 12.5h2" stroke="var(--accent-ink)" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ size = "sm", href, className }: WordmarkProps) {
  const body = (
    <span className={clsx("inline-flex items-center gap-2 font-semibold tracking-[-0.01em] text-text", size === "md" ? "text-lead" : "text-body", className)}>
      <Mark size={size === "md" ? 22 : 18} />
      Remedy
    </span>
  );
  if (!href) return body;
  return (
    <Link href={href} aria-label="Remedy, home" className="inline-flex min-h-11 items-center rounded-control">
      {body}
    </Link>
  );
}
