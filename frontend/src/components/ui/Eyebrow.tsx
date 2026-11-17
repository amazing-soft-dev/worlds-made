import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Small caps label above a heading, usually wrapped in ✦ ornaments by the caller. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-eyebrow uppercase tracking-eyebrow text-gold', className)}>{children}</p>;
}
