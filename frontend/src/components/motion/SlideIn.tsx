'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

type Props = {
  from: 'left' | 'right';
  /** Pixels the element starts away from its resting place. The hero clips the overflow. */
  distance?: number;
  className?: string;
  children: ReactNode;
};

/**
 * Hero entrance measured on the design: a spring (0.8s, bounce 0.2) after a 0.2s delay,
 * text sliding in from the left and the image from the right. Plays once on load.
 */
export function SlideIn({ from, distance = 600, className, children }: Props) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { x: from === 'left' ? -distance : distance }}
      animate={{ x: 0 }}
      transition={{ type: 'spring', duration: 0.8, bounce: 0.2, delay: 0.2 }}
    >
      {children}
    </motion.div>
  );
}
