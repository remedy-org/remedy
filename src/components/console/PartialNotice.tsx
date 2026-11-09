import { AlertIcon } from "@/components/ui";

/** Some records couldn't be read: say how many and which, and that the rest is real. Never a silent gap. */
export function PartialNotice({ what, ids, total }: { what: string; ids: string[]; total: number }) {
  if (!ids.length) return null;
  return (
    <div role="status" className="flex items-start gap-3 rounded-card bg-surface-2 px-4 py-3 text-ui shadow-[inset_0_0_0_1px_var(--line-2)]">
      <AlertIcon className="mt-0.5 shrink-0 text-muted" />
      <p className="text-text">
        Showing {total - ids.length} of {total} {what}. Remedy couldn&rsquo;t read <span className="font-mono">{ids.slice(0, 4).join(", ")}</span>
        {ids.length > 4 && ` and ${ids.length - 4} more`}; the numbers below leave {ids.length === 1 ? "it" : "them"} out. Reload to try again.
      </p>
    </div>
  );
}
