import { Fragment } from "react";

/** Text whose hyphenated words never break at the hyphen: "X-VESOLJE" stays whole, as the owner must write it. */
export function NoBreakHyphens({ children }: { children: string }) {
  return children.split(/(\s+)/).map((part, i) =>
    part.includes("-") ? (
      <span key={i} className="whitespace-nowrap">
        {part}
      </span>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}
