'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { acceptGameMessage } from '@/lib/game-messages';

type Props = {
  /** The signed link on the separate game domain. Null until it is known. */
  src: string | null;
  title: string;
  className?: string;
  /** Called with the score the game reports when it ends. */
  onScore?: (value: number) => void;
  /** Called when the player asks to fix a game that reported errors. Omit to hide the button. */
  onFix?: (errors: string[]) => void;
  /** Called when the player restarts or stops, so a page can start a new play session. */
  onRestart?: () => void;
};

/**
 * Plays an untrusted generated game. Layers on this side: the frame is sandboxed with allow-scripts only (no
 * same-origin, forms, popups or top navigation), the game lives on a separate origin with no network access, and the
 * page accepts only {type:"score"} and {type:"error"} messages from this frame's window.
 */
export function SandboxPlayer({ src, title, className, onScore, onFix, onRestart }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [run, setRun] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const msg = acceptGameMessage(event, frame.current?.contentWindow);
      if (!msg) return;
      if (msg.type === 'score') {
        setScore(msg.value);
        onScore?.(msg.value);
      } else {
        setErrors((prev) => (prev.length < 10 ? [...prev, msg.message ?? 'The game reported an error'] : prev));
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onScore]);

  /** Stop and restart are the same move: the frame is thrown away and rebuilt, which ends any runaway loop. */
  const restart = useCallback(() => {
    setRun((n) => n + 1);
    setErrors([]);
    setScore(null);
    onRestart?.();
  }, [onRestart]);

  return (
    <div className={cn('mx-auto flex w-full max-w-[360px] flex-col gap-3', className)}>
      <div className="relative aspect-[2/3] w-full border border-line bg-surface">
        {src ? (
          <iframe
            key={run}
            ref={frame}
            src={src}
            title={title}
            // allow-scripts ONLY. Never add allow-same-origin, allow-forms, allow-popups or allow-top-navigation.
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            allow=""
            loading="lazy"
            onLoad={() => frame.current?.focus()}
            className="absolute inset-0 size-full border-0"
          />
        ) : (
          <p className="grid size-full place-items-center text-copy text-envy">Loading the game…</p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={restart} disabled={!src} className="px-5">
          stop and restart
        </Button>
        {score !== null ? <p className="font-display text-base text-gold">Score {score}</p> : null}
      </div>

      {errors.length > 0 ? (
        <div role="alert" className="flex flex-col gap-3 border border-danger p-4">
          <p className="text-copy text-danger">This game ran into a problem.</p>
          {onFix ? (
            <Button onClick={() => onFix(errors)} className="self-start">
              fix it
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
