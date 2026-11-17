'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Notice, TextField } from '@/components/ui/Field';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { Pick, RecommendResult } from '@/lib/types';

function PickCard({ pick }: { pick: Pick }) {
  return (
    <article className="flex flex-col gap-4 border border-line p-5">
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-display text-lead">
          {/* Every result links to a real RAWG game record. */}
          <a href={pick.rawgUrl} target="_blank" rel="noopener noreferrer" className="hover:text-gold">
            {pick.name}
          </a>
        </h3>
        <span className={cn('shrink-0 border px-3 py-1 text-eyebrow uppercase tracking-eyebrow', pick.price === 'free' ? 'border-emerald text-emerald' : 'border-gold-mid text-gold-mid')}>
          {pick.price}
        </span>
      </div>

      <p className="text-copy">{pick.why}</p>

      <div className="flex flex-wrap gap-2">
        {pick.esrb ? <Chip>ESRB {pick.esrb}</Chip> : null}
        {pick.rating > 0 ? <Chip>★ {pick.rating.toFixed(1)}</Chip> : null}
        {pick.genres.slice(0, 3).map((g) => (
          <Chip key={g}>{g}</Chip>
        ))}
      </div>

      {pick.stores.length > 0 ? (
        <ul className="flex flex-wrap gap-x-5 gap-y-2" aria-label={`Where to get ${pick.name}`}>
          {pick.stores.map((s) => (
            <li key={s.url}>
              {/* Affiliate links are marked sponsored and are disclosed on this page. */}
              <a href={s.url} target="_blank" rel={s.affiliate ? 'sponsored noopener noreferrer' : 'noopener noreferrer'} className="text-base text-gold underline-offset-4 hover:underline">
                {s.store}{s.affiliate ? ' *' : ''}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function RecommendView() {
  const [result, setResult] = useState<RecommendResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asked, setAsked] = useState('');

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const request = String(new FormData(e.currentTarget).get('request')).trim();
    setBusy(true);
    setError(null);
    setAsked(request);
    try {
      setResult(await api<RecommendResult>('/recommend', { body: { request } }));
    } catch (err) {
      setResult(null);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <form onSubmit={submit} className="mx-auto flex w-full max-w-[720px] flex-col gap-4" aria-label="What do you feel like playing?">
        <TextField label="What do you feel like playing?" name="request" required minLength={3} maxLength={300} placeholder="a cozy free puzzle game for my phone" />
        <Button type="submit" disabled={busy} className="self-start">
          {busy ? 'searching…' : 'find games'}
        </Button>
      </form>

      {error ? <Notice tone="error">{error}</Notice> : null}

      {result ? (
        <section aria-live="polite" className="flex flex-col gap-6">
          {result.notice ? <Notice>{result.notice}</Notice> : null}
          {result.picks.length > 0 ? (
            <ul className="grid gap-5 tablet:grid-cols-2">
              {result.picks.map((p) => (
                <li key={p.id}>
                  <PickCard pick={p} />
                </li>
              ))}
            </ul>
          ) : null}

          {result.buildYourOwn ? (
            <div className="flex flex-col items-start gap-4 border border-gold p-6">
              <h3 className="font-display text-lead">Nothing quite right? Build your own</h3>
              <p className="text-copy text-envy">We can make a game from your idea: &ldquo;{asked}&rdquo;</p>
              <Button href={`/create?prompt=${encodeURIComponent(result.buildYourOwn.prefill)}`}>build it →</Button>
            </div>
          ) : null}

          <footer className="flex flex-col gap-2 border-t border-line pt-5 text-base text-envy">
            <p>
              Game data from <a className="text-gold hover:underline" href={result.attribution.url} target="_blank" rel="noopener noreferrer">{result.attribution.name}</a>. Results are limited to games rated {result.ratingLimit} and below for your age.
            </p>
            {result.affiliateDisclosure ? <p>* Some store links are affiliate links: if you buy through them we may earn a small commission, at no cost to you.</p> : null}
            <p><Link className="text-gold hover:underline" href="/parents">How we handle kids, ads and data</Link></p>
          </footer>
        </section>
      ) : null}
    </div>
  );
}
