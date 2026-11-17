'use client';

import { LICENSE_LABELS } from '@worlds-made/shared';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { SandboxPlayer } from '@/components/game/SandboxPlayer';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Notice } from '@/components/ui/Field';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Game, GalleryItem } from '@/lib/types';

type View = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  license: GalleryItem['license'];
  creator: string | null;
  likeCount: number;
  liked: boolean;
  allowDownload: boolean;
  owner: boolean;
  published: boolean;
};

/** Public games from the gallery, or the owner's own draft. */
async function loadView(id: string): Promise<View> {
  try {
    const { game } = await api<{ game: GalleryItem }>(`/gallery/${id}`);
    return { ...game, owner: false, published: true };
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) throw err;
    const { game } = await api<{ game: Game }>(`/games/${id}`);
    return { ...game, creator: null, liked: false, owner: true, published: game.status === 'published' };
  }
}

export function PlayView({ id }: { id: string }) {
  const { status } = useAuth();
  const [view, setView] = useState<View | null>(null);
  const [playUrl, setPlayUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    let cancelled = false;
    void (async () => {
      try {
        const v = await loadView(id);
        const link = await api<{ url: string }>(`/games/${id}/play-url`);
        if (!cancelled) {
          setView(v);
          setPlayUrl(link.url);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError && e.status === 404 ? 'We could not find that game. It may have been removed or is not published.' : errorMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, status]);

  async function toggleLike() {
    if (!view) return;
    try {
      const res = await api<{ liked: boolean; likeCount: number }>(`/games/${id}/like`, { method: view.liked ? 'DELETE' : 'PUT' });
      setView({ ...view, liked: res.liked, likeCount: res.likeCount });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function report(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const reason = String(new FormData(e.currentTarget).get('reason')).trim();
    try {
      await api(`/games/${id}/report`, { body: { reason } });
      setReported(true);
      setReporting(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (error && !view) return <Notice tone="error">{error}</Notice>;
  if (!view) return <Notice>Loading the game…</Notice>;
  const signedIn = status === 'ready';

  return (
    <div className="flex flex-col gap-10 desktop:flex-row desktop:items-start">
      <div className="desktop:w-[400px] desktop:flex-none">
        <SandboxPlayer src={playUrl} title={view.title} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-h3 tablet:text-[44px] tablet:leading-[56px]">{view.title}</h1>
          {view.creator ? <p className="text-copy text-envy">by {view.creator}</p> : <p className="text-copy text-envy">Your game{view.published ? '' : ' (not published yet)'}</p>}
        </div>

        {view.description ? <p className="text-lead">{view.description}</p> : null}
        {view.tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {view.tags.map((t) => (
              <Chip key={t}>{t}</Chip>
            ))}
          </div>
        ) : null}

        <p className="text-base text-envy">
          Licence: <span className="text-ink">{LICENSE_LABELS[view.license]}</span>
        </p>

        <div className="flex flex-wrap items-center gap-4">
          {view.published && !view.owner ? (
            signedIn ? (
              <Button variant={view.liked ? 'primary' : 'ghost'} onClick={() => void toggleLike()} aria-pressed={view.liked}>
                ♥ {view.liked ? 'liked' : 'like'} · {view.likeCount}
              </Button>
            ) : (
              <Button href="/login" variant="ghost">♥ {view.likeCount} · sign in to like</Button>
            )
          ) : (
            <p className="text-copy text-envy">♥ {view.likeCount}</p>
          )}
          {view.owner || view.allowDownload ? (
            <>
              <Button href={`/api/games/${id}/download?format=html`} variant="ghost" prefetch={false}>download</Button>
              <Button href={`/api/games/${id}/download?format=zip`} variant="outline" prefetch={false}>zip for itch.io</Button>
            </>
          ) : null}
          {view.owner ? <Button href={`/create?game=${id}`} variant="outline">edit this game</Button> : null}
        </div>

        {error ? <Notice tone="error">{error}</Notice> : null}

        {view.published && !view.owner ? (
          <div className="border-t border-line pt-5">
            {reported ? (
              <Notice tone="success">Thank you. We will take a look.</Notice>
            ) : reporting ? (
              <form onSubmit={report} className="flex flex-col gap-3" aria-label="Report this game">
                <label htmlFor="reason" className="text-eyebrow uppercase tracking-eyebrow text-envy">What is wrong with this game?</label>
                <textarea id="reason" name="reason" required minLength={3} maxLength={300} rows={3} className="w-full border border-line bg-bg p-3 text-copy" />
                <div className="flex gap-3">
                  <Button type="submit">send report</Button>
                  <Button variant="outline" onClick={() => setReporting(false)}>cancel</Button>
                </div>
              </form>
            ) : signedIn ? (
              <Button variant="outline" className="px-0" onClick={() => setReporting(true)}>report this game</Button>
            ) : (
              <p className="text-base text-envy"><Link className="text-gold hover:underline" href="/login">Sign in</Link> to report a game.</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
