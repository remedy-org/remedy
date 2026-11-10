import clsx from "clsx";
import Link from "next/link";
import { MARK_STUB, MARK_TAG } from "./markPaths";

export interface WordmarkProps {
  size?: "sm" | "md";
  href?: string;
  className?: string;
  nameClassName?: string;
  prefetch?: boolean;
}

/** Original return-receipt symbol. The arrow is cut through the slip so it works in one color. */
export function RemedyMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={clsx("shrink-0", className ?? "size-7")}>
      <path fill="currentColor" fillRule="evenodd" d={`${MARK_TAG}${MARK_STUB}`} />
    </svg>
  );
}

export function Wordmark({ size = "sm", href, className, nameClassName, prefetch }: WordmarkProps) {
  const body = (
    <span className={clsx("inline-flex items-center gap-2 font-display font-bold leading-none tracking-[-0.055em] text-text", size === "md" ? "text-[23px]" : "text-[18px]", className)}>
      <RemedyMark className={size === "md" ? "size-7" : "size-6"} />
      <span className={nameClassName}>remedy</span>
    </span>
  );
  if (!href) return body;
  return <Link href={href} prefetch={prefetch} aria-label="Remedy, home" className="inline-flex min-h-11 min-w-11 items-center rounded-control">{body}</Link>;
}
