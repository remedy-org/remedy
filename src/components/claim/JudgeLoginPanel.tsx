import clsx from "clsx";
import type { ReactNode } from "react";
import type { JudgeLogin } from "@/lib/demo/judgeLogin";
import { CopyValue } from "./CopyValue";

/**
 * The demo account's PayPal login, in the open: neutral (information, never the amber of the action), the email and
 * password as two plain rows of mono text, each on one line with a copy button, after one line of how-to. Rendered on
 * the server from judgeLogin(). The same rows on /try and on /signin.
 */
export function JudgeLoginPanel({ login, why, id, heading: Heading = "h3", className }: { login: JudgeLogin; why?: ReactNode; id?: string; heading?: "h2" | "h3"; className?: string }) {
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
      className={clsx("flex scroll-mt-24 flex-col gap-2 text-ui outline-none focus:outline-2 focus:outline-offset-4 focus:outline-focus", className)}
    >
      <Heading className="font-medium text-text">Demo account</Heading>
      {why && <p className="text-muted">{why}</p>}
      {/* Said first, in neutral text, before the email and password. */}
      <p className="text-muted">Use these when PayPal asks you to log in.</p>
      <dl className="flex flex-col border-b border-line">
        {rows.map((r) => (
          // One line each: the value never breaks mid-address. Copy carries the whole of it if a narrow screen cuts it.
          <div key={r.label} data-copy className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-t border-line py-2">
            <dt className="text-faint capitalize">{r.label}</dt>
            <dd data-copy-value className="col-start-1 truncate font-mono text-text select-all">
              {r.value}
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
