import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'ghost' | 'outline';

const base =
  'inline-flex h-[42px] items-center justify-center gap-2.5 whitespace-nowrap px-[30px] py-2 font-display text-base tracking-button transition-colors duration-200 ease-site focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-not-allowed disabled:opacity-50';

const variants: Record<Variant, string> = {
  primary: 'bg-gold text-bg hover:bg-gold-mid',
  ghost: 'border border-gold-deep bg-ghost text-ink hover:border-gold hover:text-gold',
  outline: 'text-gold hover:text-ink',
};

type Common = { variant?: Variant; className?: string; children: ReactNode };
type AsLink = Common & { href: string } & Omit<ComponentProps<typeof Link>, 'href' | 'className' | 'children'>;
type AsButton = Common & { href?: undefined } & Omit<ComponentProps<'button'>, 'className' | 'children'>;

/** Square gold button. Renders a Next link when `href` is given, otherwise a real <button>. */
export function Button(props: AsLink | AsButton) {
  const { variant = 'primary', className, children, ...rest } = props;
  const cls = cn(base, variants[variant], className);
  if (typeof rest.href === 'string') {
    return (
      <Link {...(rest as Omit<AsLink, keyof Common>)} href={rest.href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" {...(rest as Omit<AsButton, keyof Common>)} className={cls}>
      {children}
    </button>
  );
}
