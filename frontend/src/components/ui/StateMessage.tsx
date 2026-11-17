import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

type Props = {
  title: string;
  children?: ReactNode;
  /** Primary action, either a link or a handler. */
  action?: { label: string; href?: string; onClick?: () => void };
  secondary?: { label: string; href: string };
  role?: 'alert' | 'status';
};

/** One calm layout for empty, error, outage and not-found screens: a title, a sentence, and a way forward. */
export function StateMessage({ title, children, action, secondary, role }: Props) {
  return (
    <div role={role} className="mx-auto flex max-w-[560px] flex-col items-center gap-6 px-5 py-20 text-center">
      <div aria-hidden className="flex h-[11px] w-[159px] items-center gap-3.5">
        <span className="h-px flex-1 bg-gold-mid" />
        <span className="size-2 rotate-45 border border-gold-mid" />
        <span className="h-px flex-1 bg-gold-mid" />
      </div>
      <h1 className="font-display text-h2">{title}</h1>
      {children ? <div className="text-lead text-envy">{children}</div> : null}
      <div className="flex flex-wrap justify-center gap-4">
        {action?.href ? <Button href={action.href}>{action.label}</Button> : null}
        {action && !action.href ? <Button onClick={action.onClick}>{action.label}</Button> : null}
        {secondary ? (
          <Button href={secondary.href} variant="ghost">
            {secondary.label}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
