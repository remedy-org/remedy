"use client";

import { motion, useScroll } from "motion/react";

/** A 1px amber hairline under the nav that fills with the page's scroll: how far through the case file you are. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  return (
    <motion.div
      aria-hidden="true"
      className="absolute inset-x-0 -bottom-px h-px origin-left bg-accent motion-reduce:hidden"
      style={{ scaleX: scrollYProgress }}
    />
  );
}
