'use client';

import { LICENSE_LABELS, licenseSchema, type License } from '@worlds-made/shared';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice, SelectField, TextField } from '@/components/ui/Field';
import { api, errorMessage } from '@/lib/api';
import type { Game } from '@/lib/types';

type Props = { game: Game; onPublished: (game: Game) => void };

/** Title, short description, tags and a licence. Text and code are moderated on the server before anything goes public. */
export function PublishForm({ game, onPublished }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const published = game.status === 'published';

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ game: Game }>(`/games/${game.id}/publish`, {
        body: {
          title: String(f.get('title')).trim(),
          description: String(f.get('description')).trim(),
          tags: String(f.get('tags')).split(',').map((t) => t.trim()).filter(Boolean).slice(0, 6),
          license: String(f.get('license')),
          allowDownload: f.get('allowDownload') === 'on',
        },
      });
      onPublished(res.game);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 border border-line p-5" aria-label="Publish to the gallery">
      <h3 className="font-display text-lead">{published ? 'Update your gallery listing' : 'Publish to the gallery'}</h3>
      <TextField label="Title" name="title" required minLength={2} maxLength={60} defaultValue={game.title} />
      <TextField label="Short description" name="description" maxLength={300} defaultValue={game.description} />
      <TextField label="Tags" name="tags" defaultValue={game.tags.join(', ')} hint="Up to six, separated by commas." />
      <SelectField label="Licence" name="license" defaultValue={game.license} hint="Shown on the play page and in downloads.">
        {licenseSchema.options.map((l: License) => (
          <option key={l} value={l}>
            {LICENSE_LABELS[l]}
          </option>
        ))}
      </SelectField>
      <label className="flex items-center gap-3 text-copy">
        <input type="checkbox" name="allowDownload" defaultChecked={game.allowDownload} className="size-5 accent-gold" />
        Let other people download this game
      </label>
      <Button type="submit" disabled={busy} className="self-start">
        {published ? 'save listing' : 'publish'}
      </Button>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {published && !error ? <Notice tone="success">Your game is in the gallery.</Notice> : null}
    </form>
  );
}
