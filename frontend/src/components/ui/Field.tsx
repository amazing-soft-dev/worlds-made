import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export const inputClass =
  'w-full border border-line bg-bg px-4 py-2.5 text-copy text-ink placeholder:text-envy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-50';

type Common = { label: string; hint?: ReactNode; className?: string };

/** A labelled text input. The label is always visible and tied to the control. */
export function TextField({ label, hint, className, id, ...rest }: Common & Omit<ComponentProps<'input'>, 'className'>) {
  const fieldId = id ?? `f-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={fieldId} className="text-eyebrow uppercase tracking-eyebrow text-envy">
        {label}
      </label>
      <input id={fieldId} className={inputClass} {...rest} />
      {hint ? <p className="text-base text-envy">{hint}</p> : null}
    </div>
  );
}

export function SelectField({ label, hint, className, id, children, ...rest }: Common & Omit<ComponentProps<'select'>, 'className'>) {
  const fieldId = id ?? `f-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={fieldId} className="text-eyebrow uppercase tracking-eyebrow text-envy">
        {label}
      </label>
      <select id={fieldId} className={inputClass} {...rest}>
        {children}
      </select>
      {hint ? <p className="text-base text-envy">{hint}</p> : null}
    </div>
  );
}

/** A polite status line for results and errors, announced to screen readers. */
export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success'; children: ReactNode }) {
  const color = tone === 'error' ? 'border-danger text-danger' : tone === 'success' ? 'border-emerald text-emerald' : 'border-line text-envy';
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={cn('border px-4 py-3 text-copy', color)}>
      {children}
    </p>
  );
}
