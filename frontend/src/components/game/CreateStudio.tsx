'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { GameWorkbench } from '@/components/game/GameWorkbench';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Field';
import { inputClass } from '@/components/ui/Field';
import { ApiError, api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import type { BuiltGame, Usage } from '@/lib/types';

const GENRES = [
  { id: '', label: 'Surprise me' },
  { id: 'runner', label: 'Runner' },
  { id: 'catcher', label: 'Catcher' },
  { id: 'shooter', label: 'Shooter' },
  { id: 'quiz', label: 'Quiz' },
] as const;

/** Progress words so a long wait never looks frozen. */
function progressText(seconds: number): string {
  if (seconds < 3) return 'Checking your idea…';
  if (seconds < 30) return 'Building your game…';
  return 'Still building. Bigger ideas take a little longer…';
}

function LimitReached({ usage, resetsAt }: { usage: Usage | null; resetsAt: string | null }) {
  const when = resetsAt ?? usage?.resetsAt;
  return (
    <div className="flex flex-col gap-4 border border-line p-6" role="status">
      <h3 className="font-display text-lead">That is all your builds for today</h3>
      <p className="text-copy text-envy">
        Free accounts get a small daily allowance because every build costs real money. Yours resets {when ? `at ${new Date(when).toLocaleString()}` : 'at 00:00 UTC'}. You can still play, and the daily challenge is open.
      </p>
      <div className="flex flex-wrap gap-4">
        <Button href="/daily">today&apos;s challenge</Button>
        <Button href="/pricing" variant="ghost">see plans</Button>
      </div>
    </div>
  );
}

export function CreateStudio() {
  const { status } = useAuth();
  const params = useSearchParams();
  const [prompt, setPrompt] = useState(params.get('prompt') ?? '');
  const [genre, setGenre] = useState<string>('');
  const [usage, setUsage] = useState<Usage | null>(null);
  const [gameId, setGameId] = useState<string | null>(params.get('game'));
  const [startNote, setStartNote] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [limited, setLimited] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadUsage = useCallback(async () => {
    setUsage(await api<Usage>('/usage'));
  }, []);

  useEffect(() => {
    if (status !== 'ready') return;
    // Syncing the counter from the server on arrival.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUsage().catch(() => undefined);
  }, [status, loadUsage]);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  async function build(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLimited(null);
    setBuilding(true);
    setSeconds(0);
    timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    try {
      const res = await api<BuiltGame>('/games/generate', { body: { prompt: prompt.trim(), ...(genre ? { genre } : {}) } });
      setStartNote(res.swaps.length ? `We turned ${res.swaps.map((s) => `“${s.from}”`).join(' and ')} into an original idea: ${res.swaps.map((s) => s.to).join('; ')}.` : null);
      setGameId(res.game.id);
      await loadUsage();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'limit_reached') setLimited((err.details as { resetsAt?: string } | undefined)?.resetsAt ?? '');
      else setError(errorMessage(err));
    } finally {
      if (timer.current) clearInterval(timer.current);
      setBuilding(false);
    }
  }

  if (status === 'loading') return <Notice>Loading…</Notice>;
  if (status !== 'ready') {
    return (
      <div className="flex flex-col items-start gap-5">
        <Notice>Sign in to build games. Playing is open to everyone.</Notice>
        <div className="flex flex-wrap gap-4">
          <Button href="/login">{status === 'needs-profile' ? 'finish my account' : 'sign in'}</Button>
          <Button href="/gallery" variant="ghost">play the gallery</Button>
        </div>
      </div>
    );
  }

  const left = usage ? Math.max(0, usage.buildsLimit - usage.buildsUsed) : null;

  return (
    <div className="flex flex-col gap-10">
      {gameId ? (
        <>
          <Button variant="outline" className="self-start px-0" onClick={() => { setGameId(null); setStartNote(null); }}>
            ← make another game
          </Button>
          <GameWorkbench gameId={gameId} startNote={startNote} onUsageChanged={() => void loadUsage()} />
        </>
      ) : limited !== null || (usage && left === 0) ? (
        <LimitReached usage={usage} resetsAt={limited || null} />
      ) : (
        <form onSubmit={build} className="mx-auto flex w-full max-w-[720px] flex-col gap-6" aria-label="Describe your game">
          <div className="flex flex-col gap-2">
            <label htmlFor="prompt" className="text-eyebrow uppercase tracking-eyebrow text-envy">Describe your game</label>
            <textarea
              id="prompt"
              required
              minLength={3}
              maxLength={1000}
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A frog that hops over logs to reach the lily pad"
              className={cn(inputClass, 'resize-y')}
              disabled={building}
            />
          </div>

          <fieldset className="flex flex-col gap-3" disabled={building}>
            <legend className="mb-2 text-eyebrow uppercase tracking-eyebrow text-envy">Starting style</legend>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => (
                <label key={g.id} className={cn('cursor-pointer border px-4 py-2 text-copy transition-colors duration-200', genre === g.id ? 'border-gold text-gold' : 'border-line text-ink hover:border-gold-mid')}>
                  <input type="radio" name="genre" value={g.id} checked={genre === g.id} onChange={() => setGenre(g.id)} className="sr-only" />
                  {g.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center gap-5">
            <Button type="submit" disabled={building || prompt.trim().length < 3}>{building ? 'building…' : 'build my game'}</Button>
            {left !== null ? <p className="text-copy text-envy">{left} of {usage?.buildsLimit} builds left today</p> : null}
          </div>

          {building ? <Notice>{progressText(seconds)}</Notice> : null}
          {error ? <Notice tone="error">{error}</Notice> : null}
          <p className="text-base text-envy">
            We turn famous game names into original look-alikes, and every game is checked before you can play it. <Link className="text-gold hover:underline" href="/parents">How we keep it safe</Link>
          </p>
        </form>
      )}
    </div>
  );
}
