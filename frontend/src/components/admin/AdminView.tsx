'use client';

import { useCallback, useEffect, useState } from 'react';
import { SandboxPlayer } from '@/components/game/SandboxPlayer';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Field';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Report = { id: string; reason: string; weight: number; createdAt: string };
type QueueItem = { game: { id: string; title: string; status: string }; creator: string | null; weight: number; reports: Report[] };
type Challenge = { id: string; date: string | null; theme: string; status: string; previewUrl: string };
type Challenges = { pending: Challenge[]; scheduled: Challenge[]; backlog: Challenge[]; backlogCount: number; backlogOk: boolean };
type Costs = { monthlySpendUsd: number; capUsd: number; buildsPaused: boolean; averageByPurpose: Record<string, { calls: number; avgUsd: number }> };

export function AdminView() {
  const { status, me } = useAuth();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [challenges, setChallenges] = useState<Challenges | null>(null);
  const [costs, setCosts] = useState<Costs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [q, c, k] = await Promise.all([api<{ queue: QueueItem[] }>('/admin/reports'), api<Challenges>('/admin/challenges'), api<Costs>('/admin/costs')]);
    setQueue(q.queue);
    setChallenges(c);
    setCosts(k);
  }, []);

  const isFounder = Boolean(me?.user.isFounder);
  useEffect(() => {
    if (!isFounder) return;
    // Loading the queues from the server on arrival.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch((e) => setError(errorMessage(e)));
  }, [isFounder, load]);

  async function act(label: string, fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      setNote(label);
      await load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  if (status === 'loading') return <Notice>Loading…</Notice>;
  if (!isFounder) return <Notice>This page is for the founder only.</Notice>;

  return (
    <div className="flex flex-col gap-14">
      {note ? <Notice tone="success">{note}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      <section aria-labelledby="reports-heading" className="flex flex-col gap-4">
        <h2 id="reports-heading" className="font-display text-h3">Report queue</h2>
        <p className="text-base text-envy">Review within 48 hours. A game with three weighted reports is hidden until you decide.</p>
        {queue.length === 0 ? <p className="text-copy text-envy">Nothing to review.</p> : null}
        <ul className="flex flex-col gap-4">
          {queue.map((item) => (
            <li key={item.game.id} className="flex flex-col gap-3 border border-line p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="font-display text-lead">{item.game.title}</p>
                <p className="text-base text-envy">{item.creator ?? 'platform'} · {item.game.status} · weight {item.weight}</p>
              </div>
              <ul className="list-disc pl-5 text-copy text-envy">
                {item.reports.map((r) => (
                  <li key={r.id}>{r.reason}</li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-3">
                <Button variant="ghost" onClick={() => void act('Restored.', () => api(`/admin/reports/${item.game.id}/resolve`, { body: { action: 'restore' } }))}>restore</Button>
                <Button variant="ghost" onClick={() => void act('Dismissed.', () => api(`/admin/reports/${item.game.id}/resolve`, { body: { action: 'dismiss' } }))}>dismiss</Button>
                <Button variant="outline" className="text-danger" onClick={() => { if (window.confirm(`Remove “${item.game.title}” for good?`)) void act('Removed.', () => api(`/admin/reports/${item.game.id}/resolve`, { body: { action: 'remove' } })); }}>remove</Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="challenges-heading" className="flex flex-col gap-5">
        <h2 id="challenges-heading" className="font-display text-h3">Daily challenges</h2>
        {challenges ? (
          <>
            <Notice tone={challenges.backlogOk ? 'success' : 'error'}>
              Approved backlog: {challenges.backlogCount} (the launch needs at least 14).
            </Notice>
            <Button variant="ghost" className="self-start" onClick={() => void act('Backlog topped up.', () => api('/admin/challenges/seed-backlog', { body: {} }))}>top up the backlog</Button>
            {challenges.pending.length === 0 ? <p className="text-copy text-envy">No challenge is waiting for review.</p> : null}
            {challenges.pending.map((c) => (
              <div key={c.id} className="flex flex-col gap-4 border border-line p-5 tablet:flex-row">
                <div className="tablet:w-[300px] tablet:flex-none">
                  <SandboxPlayer src={c.previewUrl} title={`Preview: ${c.theme}`} />
                </div>
                <div className="flex flex-col gap-3">
                  <p className="font-display text-lead">{c.theme}</p>
                  <p className="text-copy text-envy">For {c.date}. Play it before you approve it.</p>
                  <div className="flex gap-3">
                    <Button onClick={() => void act('Approved.', () => api(`/admin/challenges/${c.id}/approve`, { method: 'POST', body: {} }))}>approve</Button>
                    <Button variant="outline" className="text-danger" onClick={() => void act('Rejected.', () => api(`/admin/challenges/${c.id}`, { method: 'DELETE' }))}>reject</Button>
                  </div>
                </div>
              </div>
            ))}
            {challenges.scheduled.length > 0 ? (
              <p className="text-copy text-envy">Scheduled: {challenges.scheduled.map((c) => `${c.date} ${c.theme}`).join(' · ')}</p>
            ) : null}
          </>
        ) : null}
      </section>

      <section aria-labelledby="costs-heading" className="flex flex-col gap-3">
        <h2 id="costs-heading" className="font-display text-h3">Costs</h2>
        {costs ? (
          <>
            <p className="text-copy">${costs.monthlySpendUsd.toFixed(2)} of ${costs.capUsd.toFixed(2)} spent this month{costs.buildsPaused ? ' · building is paused' : ''}.</p>
            <ul className="text-copy text-envy">
              {Object.entries(costs.averageByPurpose).map(([purpose, v]) => (
                <li key={purpose}>{purpose}: {v.calls} calls, ${v.avgUsd.toFixed(4)} each</li>
              ))}
            </ul>
          </>
        ) : null}
      </section>
    </div>
  );
}
