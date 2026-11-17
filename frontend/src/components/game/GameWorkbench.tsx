'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { SandboxPlayer } from '@/components/game/SandboxPlayer';
import { PublishForm } from '@/components/game/PublishForm';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { TextField, Notice } from '@/components/ui/Field';
import { api, errorMessage } from '@/lib/api';
import type { BuiltGame, Game } from '@/lib/types';

type Version = { id: string; prompt: string; sizeBytes: number; createdAt: string };
type Detail = { game: Game; versions: Version[] };

const SUGGESTIONS = ['slower enemies', 'bigger buttons', 'brighter colours', 'easier at the start', 'faster and harder'];

/**
 * Everything you can do with one of your games: play it, fix or change it, go back to an older version,
 * publish it, or take it with you.
 */
export function GameWorkbench({ gameId, startNote, onUsageChanged }: { gameId: string; startNote?: string | null; onUsageChanged?: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [playUrl, setPlayUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(startNote ?? null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await api<Detail>(`/games/${gameId}`);
    setDetail(d);
    const link = await api<{ url: string }>(`/games/${gameId}/play-url`);
    setPlayUrl(link.url);
  }, [gameId]);

  useEffect(() => {
    // Loading the game is a sync with the server, not derived state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch((e) => setError(errorMessage(e)));
  }, [load]);

  async function change(path: string, body: unknown, label: string) {
    setBusy(label);
    setError(null);
    try {
      const res = await api<BuiltGame>(`/games/${gameId}/${path}`, { body });
      setNote(res.charged === 'free-repair' ? 'Fixed. That repair was free.' : 'Done. That counted as one build.');
      onUsageChanged?.();
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function restore(versionId: string) {
    setBusy('restore');
    try {
      await api(`/games/${gameId}/restore`, { body: { versionId } });
      await load();
      setNote('Went back to that version.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  if (!detail) return error ? <Notice tone="error">{error}</Notice> : <Notice>Loading your game…</Notice>;
  const { game, versions } = detail;

  return (
    <div className="flex flex-col gap-10 desktop:flex-row desktop:items-start">
      <div className="flex flex-col gap-4 desktop:w-[380px] desktop:flex-none">
        <h2 className="font-display text-h3">{game.title}</h2>
        <SandboxPlayer src={playUrl} title={game.title} onFix={(errors) => void change('repair', { errors }, 'repair')} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-8">
        {note ? <Notice tone="success">{note}</Notice> : null}
        {error ? <Notice tone="error">{error}</Notice> : null}

        <section aria-labelledby="change-heading" className="flex flex-col gap-4">
          <h3 id="change-heading" className="font-display text-lead">Change it</h3>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const instruction = String(new FormData(e.currentTarget).get('instruction')).trim();
              if (instruction) void change('change', { instruction }, 'change');
            }}
          >
            <TextField label="What should be different?" name="instruction" required minLength={3} maxLength={500} placeholder="slower enemies" />
            <div className="flex flex-wrap gap-2" aria-label="Suggestions">
              {SUGGESTIONS.map((s) => (
                <Button key={s} variant="ghost" className="h-8 px-3 text-base" onClick={() => void change('change', { instruction: s }, 'change')} disabled={busy !== null}>
                  {s}
                </Button>
              ))}
            </div>
            <Button type="submit" disabled={busy !== null} className="self-start">
              {busy === 'change' ? 'changing…' : 'change it'}
            </Button>
          </form>
          <p className="text-base text-envy">A change counts as one build. Fixing errors is free twice per build.</p>
        </section>

        <section aria-labelledby="versions-heading" className="flex flex-col gap-3">
          <h3 id="versions-heading" className="font-display text-lead">Versions</h3>
          <ul className="divide-y divide-line border-y border-line">
            {versions.map((v, i) => (
              <li key={v.id} className="flex items-center justify-between gap-4 py-3">
                <span className="min-w-0 truncate text-copy">
                  {i === 0 ? <Chip className="mr-3">current</Chip> : null}
                  {v.prompt}
                </span>
                {game.currentVersionId !== v.id ? (
                  <Button variant="outline" className="h-8 px-3" onClick={() => void restore(v.id)} disabled={busy !== null}>
                    use this
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        <PublishForm game={game} onPublished={(g) => { setDetail({ game: g, versions }); setNote('Published. Anyone can play it now.'); }} />

        <div className="flex flex-wrap gap-4">
          <Button href={`/api/games/${game.id}/download?format=html`} variant="ghost" prefetch={false}>
            download .html
          </Button>
          <Button href={`/api/games/${game.id}/download?format=zip`} variant="ghost" prefetch={false}>
            download .zip for itch.io
          </Button>
          {game.status === 'published' ? <Button href={`/play/${game.id}`} variant="outline">view in the gallery →</Button> : null}
        </div>
        <p className="text-base text-envy">
          Downloaded files carry a header with this site and your licence. Open them only in a web browser. <Link className="text-gold hover:underline" href="/account">All my games</Link>
        </p>
      </div>
    </div>
  );
}
