'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Countdown } from '@/components/daily/Countdown';
import { SandboxPlayer } from '@/components/game/SandboxPlayer';
import { Notice } from '@/components/ui/Field';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { BoardEntry, DailyInfo } from '@/lib/types';

type Me = { best: number | null; rank: number | null; streak: { current: number; best: number } };
type Result = { score: number; best: number; rank: number; streak: { current: number; best: number } };

export function DailyView() {
  const { status } = useAuth();
  const [info, setInfo] = useState<DailyInfo | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [board, setBoard] = useState<BoardEntry[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const session = useRef<string | null>(null);

  const refreshBoard = useCallback(async () => {
    const [b, m] = await Promise.all([api<{ entries: BoardEntry[] }>('/daily/leaderboard'), api<Me>('/daily/me')]);
    setBoard(b.entries);
    setMe(m);
  }, []);

  /** A fresh play session for every attempt: a score only counts with the token its play started with. */
  const startSession = useCallback(async () => {
    try {
      session.current = (await api<{ sessionToken: string }>('/daily/start', { method: 'POST', body: {} })).sessionToken;
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    let cancelled = false;
    void (async () => {
      try {
        const d = await api<DailyInfo>('/daily');
        if (cancelled) return;
        setInfo(d);
        await Promise.all([startSession(), refreshBoard()]);
      } catch (e) {
        if (!cancelled) setError(errorMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, startSession, refreshBoard]);

  const onScore = useCallback(
    async (value: number) => {
      const token = session.current;
      if (!token) return;
      session.current = null; // one score per play
      try {
        setResult(await api<Result>('/daily/score', { body: { sessionToken: token, value } }));
        await refreshBoard();
      } catch (e) {
        setError(errorMessage(e));
      }
    },
    [refreshBoard],
  );

  const onRestart = useCallback(() => {
    setResult(null);
    void startSession();
  }, [startSession]);

  if (error && !info) return <Notice tone="error">{error}</Notice>;
  if (!info) return <Notice>Loading today&apos;s challenge…</Notice>;
  const signedIn = status === 'ready';

  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-eyebrow uppercase tracking-eyebrow text-envy">Next challenge in</p>
        <Countdown to={info.nextRolloverAt} onDone={() => window.location.reload()} />
      </div>

      <div className="flex flex-col gap-10 desktop:flex-row desktop:items-start">
        <div className="flex flex-col gap-4 desktop:w-[400px] desktop:flex-none">
          <h2 className="text-center font-display text-lead">Today: {info.theme}</h2>
          <SandboxPlayer src={info.playUrl} title={`Daily challenge: ${info.theme}`} onScore={(v) => void onScore(v)} onRestart={onRestart} />
          {result ? (
            <Notice tone="success">
              You scored {result.score}. Your best today is {result.best}, rank #{result.rank}. Streak: {result.streak.current} {result.streak.current === 1 ? 'day' : 'days'}.
            </Notice>
          ) : null}
          {error ? <Notice tone="error">{error}</Notice> : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-8">
          <section aria-labelledby="streak-heading" className="grid grid-cols-3 gap-px border border-line bg-line text-center">
            {[
              ['Streak', `${me?.streak.current ?? 0}`],
              ['Best streak', `${me?.streak.best ?? 0}`],
              ['Today', typeof me?.best === 'number' ? String(me.best) : '–'],
            ].map(([label, value]) => (
              <div key={label} className="bg-bg p-4">
                <p id={label === 'Streak' ? 'streak-heading' : undefined} className="text-eyebrow uppercase tracking-eyebrow text-envy">{label}</p>
                <p className="font-display text-h3 text-gold">{value}</p>
              </div>
            ))}
          </section>
          {!signedIn ? (
            <p className="text-copy text-envy">
              You are playing as a guest, so your streak is kept on this device. <Link className="text-gold hover:underline" href="/login">Sign in</Link> to save your streak and score to your account.
            </p>
          ) : null}

          <section aria-labelledby="board-heading" className="flex flex-col gap-3">
            <h2 id="board-heading" className="font-display text-lead">Today&apos;s top 100</h2>
            {board.length === 0 ? (
              <p className="text-copy text-envy">No scores yet. Be the first.</p>
            ) : (
              <ol className="max-h-[420px] divide-y divide-line overflow-auto border border-line">
                {board.map((e) => (
                  <li key={e.rank} className="flex items-center gap-4 px-4 py-2 text-copy">
                    <span className="w-8 text-envy tabular-nums">{e.rank}</span>
                    <span className="flex-1 truncate">{e.name}</span>
                    <span className="font-display text-base tabular-nums text-gold">{e.score}</span>
                  </li>
                ))}
              </ol>
            )}
            <p className="text-base text-envy">No prizes: scores come from your browser and can be faked, so this is just for fun.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
