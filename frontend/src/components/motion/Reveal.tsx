'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

type Props = { delay?: number; className?: string; children: ReactNode };

/** Fades and lifts content into view once. Skipped entirely when the visitor prefers reduced motion. */
export function Reveal({ delay = 0, className, children }: Props) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: [0.44, 0, 0.56, 1] }}
    >
      {children}
    </motion.div>
  );
}
