import clsx from "clsx";
import Link from "next/link";

export interface WordmarkProps {
  /** sm for app chrome (16px type, 18px mark), md for the homepage nav (20px type, 22px mark). */
  size?: "sm" | "md";
  /** Wrap in a link, usually "/". */
  href?: string;
  className?: string;
}

/**
 * The mark is an evidence tag: amber card, top corners cut, a punched hole the page shows through, the code written
 * on it, and a string loop. It hangs at the stamp's -8deg. The string draws in once on load (static under reduced
 * motion, see .mark-string in globals.css).
 */
function Mark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="1.5 2.5 21 21" aria-hidden="true" focusable="false" className="shrink-0 overflow-visible">
      <g transform="rotate(-8 12 15)">
        <path
          fillRule="evenodd"
          fill="var(--accent)"
          d="M9.5 8.5h5l3.5 3.5v9.25c0 .97-.78 1.75-1.75 1.75h-8.5c-.97 0-1.75-.78-1.75-1.75V12zM13.5 12a1.5 1.5 0 1 0-3 0a1.5 1.5 0 1 0 3 0z"
        />
        <path d="M9 16.25h6M9 19.25h3.5" stroke="var(--accent-ink)" strokeWidth="1.5" strokeLinecap="round" />
        <path
          className="mark-string"
          pathLength={1}
          d="M12 12C10.4 9 9.2 5 11.6 3.6c2.4-1.4 4.2 1.8 2.1 4.8-.6.9-1.1 2.1-1.3 3.5"
          fill="none"
          stroke="var(--muted)"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
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
