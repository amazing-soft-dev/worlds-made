'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { GameCard } from '@/components/game/GameCard';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Field';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import type { GalleryItem } from '@/lib/types';

const TABS = [
  { id: 'new', label: 'New' },
  { id: 'top-week', label: 'Most liked this week' },
  { id: 'staff-picks', label: 'Staff picks' },
] as const;
type TabId = (typeof TABS)[number]['id'];
const PAGE = 12;

export function GalleryView() {
  const { status } = useAuth();
  const [tab, setTab] = useState<TabId>('new');
  const [games, setGames] = useState<GalleryItem[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const load = useCallback(async (which: TabId, offset: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ games: GalleryItem[] }>(`/gallery?tab=${which}&limit=${PAGE}&offset=${offset}`);
      setGames((prev) => (offset === 0 ? res.games : [...prev, ...res.games]));
      setMore(res.games.length === PAGE);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    // Reload when the tab changes or sign-in state resolves (likes are per viewer).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(tab, 0);
  }, [tab, status, load]);

  /** Arrow keys move between tabs, as in the ARIA tabs pattern. */
  function onKey(e: KeyboardEvent, i: number) {
    const next = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i + TABS.length - 1) % TABS.length : null;
    if (next === null) return;
    e.preventDefault();
    setTab(TABS[next]!.id);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="flex flex-col gap-8">
      <div role="tablist" aria-label="Gallery" className="flex flex-wrap justify-center gap-2">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => { tabRefs.current[i] = el; }}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="gallery-panel"
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn('border px-5 py-2 font-display text-base tracking-button transition-colors duration-200 ease-site focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold', tab === t.id ? 'border-gold bg-gold text-bg' : 'border-line text-ink hover:border-gold-mid')}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div id="gallery-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} aria-busy={loading} className="flex flex-col gap-8">
        {error ? <Notice tone="error">{error}</Notice> : null}
        {!loading && games.length === 0 && !error ? (
          <div className="flex flex-col items-center gap-4 border border-line p-10 text-center">
            <p className="text-lead">{tab === 'staff-picks' ? 'No staff picks yet.' : tab === 'top-week' ? 'Nothing has been liked this week yet.' : 'No games have been published yet.'}</p>
            <Button href="/create">make the first one</Button>
          </div>
        ) : (
          <ul className="grid gap-5 tablet:grid-cols-2 desktop:grid-cols-4">
            {games.map((g) => (
              <li key={g.id}>
                <GameCard game={g} />
              </li>
            ))}
          </ul>
        )}
        {loading ? <p className="text-center text-copy text-envy">Loading…</p> : null}
        {more && !loading ? (
          <Button variant="ghost" className="self-center" onClick={() => void load(tab, games.length)}>
            show more
          </Button>
        ) : null}
      </div>
    </div>
  );
}
