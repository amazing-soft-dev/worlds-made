import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Props = { as?: ElementType; className?: string; children: ReactNode };

/** Square panel with the 1px gold border used for skills, plans and quick-fact boxes. */
export function Card({ as: Tag = 'div', className, children }: Props) {
  return <Tag className={cn('border border-line bg-bg p-6', className)}>{children}</Tag>;
}
