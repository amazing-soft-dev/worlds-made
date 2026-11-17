'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Notice } from '@/components/ui/Field';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Game, Usage } from '@/lib/types';

const BAND_LABEL = { under13: 'Under 13', '13to17': '13 to 17', adult: 'Adult' } as const;

function UsageMeter({ usage }: { usage: Usage }) {
  const pct = Math.min(100, Math.round((usage.buildsUsed / usage.buildsLimit) * 100));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <p className="text-copy">{usage.buildsUsed} of {usage.buildsLimit} builds used today</p>
        <p className="text-base text-envy">resets {new Date(usage.resetsAt).toLocaleString()}</p>
      </div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={usage.buildsLimit} aria-valuenow={usage.buildsUsed} aria-label="Builds used today" className="h-2 w-full border border-line">
        <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-base text-envy">Fixing errors is free twice per build. {usage.repairsUsed} free {usage.repairsUsed === 1 ? 'fix' : 'fixes'} used today.</p>
    </div>
  );
}

export function AccountView() {
  const { status, me, signOut, refresh } = useAuth();
  const params = useSearchParams();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [u, g] = await Promise.all([api<Usage>('/usage'), api<{ games: Game[] }>('/games')]);
    setUsage(u);
    setGames(g.games);
  }, []);

  useEffect(() => {
    if (status !== 'ready') return;
    // Syncing the page with the server on arrival.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch((e) => setError(errorMessage(e)));
  }, [status, load]);

  // Coming back from Stripe: ask the server what Stripe says, then refresh the plan.
  useEffect(() => {
    if (status !== 'ready' || params.get('billing') !== 'success') return;
    void api('/billing/sync', { method: 'POST', body: {} })
      .then(() => refresh())
      .then(() => load())
      .then(() => setNotice('Thank you! Your plan is updated.'))
      .catch(() => undefined);
  }, [status, params, refresh, load]);

  async function go(path: '/billing/checkout' | '/billing/portal') {
    setError(null);
    try {
      const { url } = await api<{ url: string }>(path, { method: 'POST', body: {} });
      window.location.assign(url);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function remove(game: Game) {
    if (!window.confirm(`Delete “${game.title}”? This cannot be undone.`)) return;
    try {
      await api(`/games/${game.id}`, { method: 'DELETE' });
      setGames((g) => g.filter((x) => x.id !== game.id));
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  if (status === 'loading') return <Notice>Loading…</Notice>;
  if (status !== 'ready' || !me?.profile) {
    return (
      <div className="flex flex-col items-start gap-4">
        <Notice>Sign in to see your games and plan.</Notice>
        <Button href="/login">{status === 'needs-profile' ? 'finish my account' : 'sign in'}</Button>
      </div>
    );
  }
  const { profile, user } = me;
  const paid = profile.plan === 'paid';

  return (
    <div className="flex flex-col gap-12">
      {notice ? <Notice tone="success">{notice}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      <section aria-labelledby="profile-heading" className="flex flex-col gap-3">
        <h2 id="profile-heading" className="font-display text-h3">{profile.display_name}</h2>
        <div className="flex flex-wrap items-center gap-3 text-copy text-envy">
          <span>{user.email}</span>
          <Chip>{BAND_LABEL[profile.age_band]}</Chip>
          <Chip className={paid ? 'border-gold text-gold' : undefined}>{paid ? 'Maker plan' : 'Free plan'}</Chip>
        </div>
        <Button variant="outline" className="self-start px-0" onClick={signOut}>sign out</Button>
      </section>

      <section aria-labelledby="plan-heading" className="flex flex-col gap-5 border border-line p-6">
        <h2 id="plan-heading" className="font-display text-lead">Your plan</h2>
        {usage ? <UsageMeter usage={usage} /> : null}
        {paid ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-copy text-envy">Thank you for supporting the site. Manage your payment method or cancel at any time.</p>
            <Button variant="ghost" onClick={() => void go('/billing/portal')}>manage billing</Button>
          </div>
        ) : profile.age_band === 'adult' ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-copy text-envy">The Maker plan gives you a bigger daily allowance. Payments are handled by Stripe; we never see your card.</p>
            <Button onClick={() => void go('/billing/checkout')}>upgrade to Maker</Button>
          </div>
        ) : (
          <p className="text-copy text-envy">The paid plan is for adults. If you would like it, ask a parent to sign up on their own account.</p>
        )}
      </section>

      <section aria-labelledby="games-heading" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 id="games-heading" className="font-display text-lead">My games</h2>
          <Button href="/create" variant="outline">make a game</Button>
        </div>
        {games.length === 0 ? (
          <p className="text-copy text-envy">You have not made a game yet.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {games.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="truncate font-display text-base tracking-button">{g.title}</p>
                  <p className="text-base text-envy">
                    {g.status === 'published' ? 'In the gallery' : g.status === 'hidden' ? 'Hidden while we review it' : g.status === 'removed' ? 'Removed' : 'Draft'} · ♥ {g.likeCount}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button href={`/play/${g.id}`} variant="ghost" className="h-8 px-3">play</Button>
                  <Button href={`/create?game=${g.id}`} variant="ghost" className="h-8 px-3">edit</Button>
                  <Button variant="outline" className="h-8 px-3 text-danger" onClick={() => void remove(g)}>delete</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-base text-envy">
        <Link className="text-gold hover:underline" href="/legal/privacy">Privacy</Link> ·{' '}
        <Link className="text-gold hover:underline" href="/parents">For parents</Link>
      </p>
    </div>
  );
}
