import type { ReactNode } from "react";
import styles from "./device.module.css";

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
              <span className="font-mono">CPSC 27-071</span>
              <hr />
              X-VESOLJE Nursing Pillows
              <br />
              19,596 units
            </div>
          </div>
          <div className={styles.deck} aria-hidden="true">
            <div className={styles.hinge} />
            {/* No drawn keys: one inset keyboard well, as a product shot shows a deck at this distance. */}
            <div className={styles.keys} />
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
