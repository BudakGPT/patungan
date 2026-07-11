"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";

/**
 * Shared motion vocabulary for the brand surfaces. One easing (out-quint), one
 * direction (rise), staggered by explicit delays — so every page choreographs the
 * same way. Everything degrades to static rendering under prefers-reduced-motion.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Rise-and-fade reveal. `mode="load"` plays on mount (hero entrances);
 * `mode="scroll"` (default) plays once when scrolled into view.
 */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  mode = "scroll",
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  mode?: "load" | "scroll";
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  const visible = { opacity: 1, y: 0 };
  const hidden = { opacity: 0, y };
  return (
    <motion.div
      className={className}
      initial={hidden}
      {...(mode === "load"
        ? { animate: visible }
        : { whileInView: visible, viewport: { once: true, margin: "-80px" } })}
      transition={{ duration: 0.75, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Count-up figure: sweeps from 0 to `value` the first time it enters the viewport,
 * then tracks later live-data changes instantly (no re-sweep jitter on refetch).
 */
export function CountUp({
  value,
  format = (n) => Math.round(n).toLocaleString("id-ID"),
  className,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [display, setDisplay] = useState(() => (reduced ? value : 0));
  const swept = useRef(false);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    if (!inView) return;
    if (swept.current) {
      setDisplay(value);
      return;
    }
    swept.current = true;
    const from = 0;
    const duration = 1100;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 5);
      setDisplay(from + (value - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, reduced]);

  return (
    <span ref={ref} className={className}>
      {format(display)}
    </span>
  );
}

/** Slow vertical drift for hero backdrops as the page scrolls. */
export function ParallaxImg({
  src,
  alt,
  className,
  drift = 60,
}: {
  src: string;
  alt: string;
  className?: string;
  drift?: number;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const raw = useTransform(scrollYProgress, [0, 1], [0, drift]);
  const y = useSpring(raw, { stiffness: 90, damping: 30, mass: 0.6 });

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden">
      <motion.img
        src={src}
        alt={alt}
        className={className}
        style={reduced ? undefined : { y, scale: 1.12 }}
      />
    </div>
  );
}
