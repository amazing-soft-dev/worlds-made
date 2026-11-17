import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Eyebrow } from './Eyebrow';

type Props = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  /** Heading element; the page title should be an h1, sections h2. */
  as?: 'h1' | 'h2';
  className?: string;
};

/** Centred section heading: eyebrow, Cinzel title, optional lead paragraph. */
export function SectionTitle({ eyebrow, title, description, as: Heading = 'h2', className }: Props) {
  return (
    <header className={cn('mx-auto flex max-w-[700px] flex-col items-center gap-5 text-center', className)}>
      {eyebrow ? <Eyebrow>✦ {eyebrow} ✦</Eyebrow> : null}
      <Heading className="font-display text-h2 tablet:text-[60px] tablet:leading-[96px]">{title}</Heading>
      {description ? <p className="text-lead text-ink">{description}</p> : null}
    </header>
  );
}
