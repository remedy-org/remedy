import type { ReactNode } from "react";
import styles from "./device.module.css";

// The laptop's keyboard as one SVG: a function row, four rows of keys and a space-bar row. The geometry is
// a plain 580 x 205 grid; widths in each row add up so the rows end flush.
const ROWS: { y: number; h: number; keys: number[] }[] = [
  { y: 0, h: 18, keys: Array(14).fill(38.57) },
  { y: 24, h: 34, keys: [38, ...Array(12).fill(36), 74] },
  { y: 64, h: 34, keys: [56, ...Array(12).fill(36), 56] },
  { y: 104, h: 34, keys: [66, ...Array(11).fill(36), 82.5] },
  { y: 144, h: 34, keys: [86, ...Array(10).fill(36), 103.5] },
  { y: 184, h: 21, keys: [38, 38, 38, 48, 220, 48, 38, 38, 38] },
];
const GAP = 4.2;

function Keyboard() {
  return (
    <svg viewBox="0 0 580 205" preserveAspectRatio="none" className={styles.keys} aria-hidden="true">
      {ROWS.flatMap((row, r) => {
        const total = row.keys.reduce((a, b) => a + b, 0) + GAP * (row.keys.length - 1);
        let x = (580 - total) / 2;
        return row.keys.map((w, k) => {
          const rect = <rect key={`${r}-${k}`} x={x} y={row.y} width={w} height={row.h} rx={4} fill="oklch(0.17 0.006 255)" stroke="oklch(1 0 0 / 0.05)" />;
          x += w + GAP;
          return rect;
        });
      })}
    </svg>
  );
}

// The ruler numbers along the table's back edge, every 5cm (1cm = 2.4em).
const RULER = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

/** The device on the light table. `screen` renders inside the lid; `tilt` wraps the pointer-tilt layer. */
export function Laptop({ screen, renderTilt }: { screen: ReactNode; renderTilt: (children: ReactNode) => ReactNode }) {
  return (
    <div className={styles.scene} data-laptop>
      {renderTilt(
        <>
          <div className={styles.table} aria-hidden="true">
            {RULER.map((cm) => (
              <span key={cm} className={styles.ruler} style={{ left: `calc(50% - 60em + ${cm * 2.4}em)`, top: "110em" }}>
                {cm}
              </span>
            ))}
            <span className={styles.ruler} style={{ left: "calc(50% - 63.5em)", top: "110em" }}>
              CM
            </span>
            <div className={styles.tag} style={{ left: "calc(50% + 34em)", top: "113em" }}>
              Exhibit · CPSC 27-071
              <hr />
              Kikea X-VESOLJE
              <br />
              19,596 units
            </div>
          </div>
          <div className={styles.deck} aria-hidden="true">
            <div className={styles.hinge} />
            <Keyboard />
            <div className={styles.pad} />
            <div className={styles.lip} />
          </div>
          <div className={styles.lid}>
            <span className={styles.camera} aria-hidden="true" />
            <div className={styles.screen} data-laptop-screen>
              {screen}
            </div>
          </div>
        </>,
      )}
    </div>
  );
}
