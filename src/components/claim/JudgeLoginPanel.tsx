import clsx from "clsx";
import type { ReactNode } from "react";
import type { JudgeLogin } from "@/lib/demo/judgeLogin";
import { CopyValue } from "./CopyValue";

/**
 * The demo account's PayPal login, in the open: neutral (information, never the amber of the action), the email and
 * password as mono text with a copy button each, and one line of how-to. Rendered on the server from judgeLogin().
 */
export function JudgeLoginPanel({ login, why, id, className }: { login: JudgeLogin; why?: ReactNode; id?: string; className?: string }) {
  const rows = [
    { label: "email", value: login.email },
    { label: "password", value: login.password },
  ];
  return (
    // id: the phone's bar brings it into view and focuses it before it offers the PayPal login.
    <section
      id={id}
      tabIndex={id ? -1 : undefined}
      aria-label="Demo account"
      className={clsx("flex scroll-mt-24 flex-col gap-3 rounded-card bg-surface-2 p-4 text-ui shadow-[inset_0_0_0_1px_var(--line-2)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus", className)}
    >
      <div className="flex flex-col gap-1">
        <h3 className="micro text-faint">Demo account</h3>
        {why && <p className="text-text">{why}</p>}
        {/* Said first, in neutral text, before the email and password. */}
        <p className="text-muted">Use these when PayPal asks you to log in.</p>
      </div>
      <dl className="flex flex-col">
        {rows.map((r) => (
          // The label over the value, so a long email gets the row's whole width and breaks only if it must.
          <div key={r.label} data-copy className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-t border-line py-2.5 last:pb-0">
            <dt className="text-faint capitalize">{r.label}</dt>
            <dd data-copy-value className="col-start-1 font-mono text-text select-all [overflow-wrap:anywhere]">
              {/* A long email breaks at its @ first. */}
              {r.value.split("@").map((part, i) => (i ? [<wbr key={i} />, `@${part}`] : part))}
            </dd>
            <dd className="col-start-2 row-span-2 row-start-1">
              <CopyValue label={r.label} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
