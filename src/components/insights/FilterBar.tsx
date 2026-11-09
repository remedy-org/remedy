import type { Ref } from "react";
import { filterLabel, type FilterPick } from "./report";

const plural = (n: number, one: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : `${one}s`}`;

/**
 * The page's filter, said in words with a way out: a pick in one panel changes every number on the page. Always there at
 * one height, saying how to pick until something is, so nothing under it moves when a pick lands. `shown` is null when a
 * pick can't be read as claims (an analyst's chart), so the figures above count every claim.
 */
export function FilterBar({ picks, shown, total, onClear, ref }: { picks: FilterPick[]; shown: number | null; total: number; onClear: () => void; ref?: Ref<HTMLDivElement> }) {
  const filtered = picks.length > 0;
  return (
    <div className="page">
      <div ref={ref} tabIndex={-1} role="status" className="flex h-11 items-center gap-x-3 border-b border-line text-ui outline-none">
        {!filtered && (
          <p className="min-w-0 truncate text-muted">
            Showing all {plural(total, "claim")} · Pick a decision, a drop or a reason to filter the page
          </p>
        )}
        {filtered && (
          <>
            <p className="min-w-0 truncate text-muted">
              Showing <span className="font-medium text-text">{filterLabel(picks)}</span>
              {shown !== null ? (
                <>
                  {" "}
                  · <span className="tabular-nums text-text">{shown}</span> of {plural(total, "claim")}
                </>
              ) : (
                " · the figures above count every claim"
              )}
            </p>
            <button
              type="button"
              onClick={onClear}
              className="shrink-0 rounded-control px-2 py-1 font-medium text-text underline decoration-line-2 underline-offset-4 hover:decoration-text focus-visible:outline-2 focus-visible:outline-offset-0"
            >
              Clear filter
            </button>
          </>
        )}
      </div>
    </div>
  );
}
