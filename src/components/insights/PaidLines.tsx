import { paidDays, PAID_BY_DAY } from "./report";

const plural = (n: number, one: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : `${one}s`}`;
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** What PayPal paid, a line a day, where a chart of one or two columns would stand nearly empty across the page. */
export function PaidLines({ days, className = "page", id = "paid-lines" }: { days: ReturnType<typeof paidDays>; className?: string; id?: string }) {
  return (
    <section aria-labelledby={id} className={className}>
      <div className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 id={id} className="text-ui font-medium">
          {PAID_BY_DAY}
        </h2>
        {days.length ? (
          <ul className="flex max-w-[36rem] flex-col text-ui">
            {days.map((d) => (
              <li key={d.day} className="flex items-baseline justify-between gap-6 border-b border-line py-2.5">
                <span>
                  {d.day} <span className="text-muted">· {plural(d.payouts, "payout")}</span>
                </span>
                <span className="font-mono text-text">{usd.format(d.dollars)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ui text-muted">Nothing paid through PayPal yet.</p>
        )}
      </div>
    </section>
  );
}
