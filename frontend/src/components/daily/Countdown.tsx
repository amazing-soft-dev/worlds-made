'use client';

import { useEffect, useState } from 'react';

function left(to: number): number {
  return Math.max(0, Math.floor((to - Date.now()) / 1000));
}

const pad = (n: number) => String(n).padStart(2, '0');

export function formatCountdown(seconds: number): string {
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
}

/** Counts down to the next 00:00 UTC rollover. Not announced every second to screen readers. */
export function Countdown({ to, onDone }: { to: string; onDone?: () => void }) {
  const target = new Date(to).getTime();
  const [seconds, setSeconds] = useState(() => left(target));

  useEffect(() => {
    const id = setInterval(() => {
      const s = left(target);
      setSeconds(s);
      if (s === 0) onDone?.();
    }, 1000);
    return () => clearInterval(id);
  }, [target, onDone]);

  return (
    <time dateTime={to} className="font-display text-h3 tabular-nums text-gold" aria-label={`Next challenge in ${formatCountdown(seconds)}`}>
      {formatCountdown(seconds)}
    </time>
  );
}
