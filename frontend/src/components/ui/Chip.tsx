import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Small outlined tag, for genres and project labels. */
export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center border border-line px-3.5 text-eyebrow uppercase tracking-eyebrow text-gold-mid',
        className,
      )}
    >
      {children}
    </span>
  );
}
