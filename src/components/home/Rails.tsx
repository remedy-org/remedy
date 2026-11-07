import clsx from "clsx";
import styles from "./home.module.css";

// Enough labels for a page far taller than ours (7,600px at most): one every fourth 96px tick, so every 384px.
const LABELS = Array.from({ length: 30 }, (_, i) => (i + 1) * 4);

/**
 * The homepage's page rails (laptops): the light table's ruler run down the whole page. Two 1px lines at the 1200px
 * content edges, a tick every 96px, a centimetre label every fourth tick, and a last tick labelled "end of exhibit".
 * Behind every section (the paper band covers them), never on phones.
 */
export function Rails() {
  return (
    <div aria-hidden="true" className={clsx(styles.rails, "hidden lg:block")}>
      <div className={clsx(styles.rail, styles.railLeft)} />
      <div className={clsx(styles.rail, styles.railRight)} />
      {LABELS.map((n) => (
        <span key={n} className={styles.railLabel} style={{ top: n * 96, right: "calc(50% + 600px + 10px)" }}>
          {n}
        </span>
      ))}
      <span className="absolute bottom-10 left-[calc(50%-600px-12px)] h-px w-6 bg-line-strong" />
      <span className={clsx(styles.railLabel, "bottom-10 uppercase")} style={{ right: "calc(50% + 600px + 16px)", translate: "0 50%" }}>
        End of exhibit
      </span>
    </div>
  );
}
