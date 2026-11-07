import clsx from "clsx";
import type { ReactNode } from "react";
import type { JudgeLogin } from "@/lib/demo/judgeLogin";
import { CopyValue } from "./CopyValue";

/**
 * The judges' PayPal sandbox login, in the open: neutral (information, never the amber of the action), the email and
 * password as mono text with a copy button each, and one line of how-to. Rendered on the server from judgeLogin().
 */
export function JudgeLoginPanel({ login, why, className }: { login: JudgeLogin; why?: ReactNode; className?: string }) {
  const rows = [
    { label: "email", value: login.email },
    { label: "password", value: login.password },
  ];
  return (
    <section aria-label="Judges' sandbox login" className={clsx("flex flex-col gap-3 rounded-card bg-surface-2 p-4 text-ui shadow-[inset_0_0_0_1px_var(--line-2)]", className)}>
      <div className="flex flex-col gap-1">
        <h3 className="micro text-faint">Judges&apos; sandbox login</h3>
        {why && <p className="text-text">{why}</p>}
        <p className="text-muted">Log in with PayPal, then use this sandbox login.</p>
      </div>
      <dl className="flex flex-col">
        {rows.map((r) => (
          // The label over the value, so a long sandbox email gets the row's whole width and breaks only if it must.
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
