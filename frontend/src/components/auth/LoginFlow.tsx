'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice, SelectField, TextField } from '@/components/ui/Field';
import { api, errorMessage } from '@/lib/api';
import { sendMagicLink, supabaseConfig, useAuth } from '@/lib/auth';
import { COUNTRIES } from '@/lib/countries';
import type { AgeState } from '@/lib/types';

type Step = 'loading' | 'age' | 'email' | 'check-email' | 'profile' | 'blocked';

/**
 * Sign-in in three short steps: a neutral year-of-birth question, then email, then (adults only) a display name.
 * The age question gives no hint about which answer unlocks more, and the first answer is remembered by the server.
 * Visitors who cannot hold an account can still play everything else.
 */
export function LoginFlow() {
  const router = useRouter();
  const { status, acceptToken, refresh } = useAuth();
  const [step, setStep] = useState<Step>('loading');
  const [age, setAge] = useState<AgeState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Work out where in the flow this visitor is.
  useEffect(() => {
    if (status === 'loading') return;
    let cancelled = false;
    void (async () => {
      const state = await api<AgeState>('/age').catch(() => ({ answered: false }) as AgeState);
      if (cancelled) return;
      setAge(state);
      if (status === 'ready') return router.replace('/create');
      if (!state.answered) return setStep('age');
      if (!state.canHaveAccount) return setStep('blocked');
      setStep(status === 'needs-profile' ? 'profile' : 'email');
    })();
    return () => {
      cancelled = true;
    };
  }, [status, router]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const onAge = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    void run(async () => {
      const state = await api<AgeState>('/age', { body: { birthYear: Number(form.get('year')), country: String(form.get('country')) === 'XX' ? undefined : String(form.get('country')) } });
      setAge(state);
      setStep(state.canHaveAccount ? 'email' : 'blocked');
    });
  };

  const onEmail = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get('email')).trim();
    void run(async () => {
      if (supabaseConfig) {
        await sendMagicLink(email);
        setStep('check-email');
      } else {
        // No Supabase configured: local development sign-in, no email is sent.
        const { token } = await api<{ token: string }>('/auth/dev-token', { body: { email } });
        await acceptToken(token);
      }
    });
  };

  const onProfile = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const displayName = String(new FormData(e.currentTarget).get('displayName') ?? '').trim();
    void run(async () => {
      await api('/me/profile', { body: displayName ? { displayName } : {} });
      await refresh();
      router.replace('/create');
    });
  };

  const years = Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i);
  const isAdult = age?.band === 'adult';

  return (
    <div className="mx-auto flex w-full max-w-[460px] flex-col gap-6">
      {step === 'loading' && <Notice>Loading…</Notice>}

      {step === 'age' && (
        <form onSubmit={onAge} className="flex flex-col gap-5" aria-label="About you">
          <p className="text-copy text-envy">Two quick questions before you make an account.</p>
          <SelectField label="Year you were born" name="year" required defaultValue="">
            <option value="" disabled>
              Choose a year
            </option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </SelectField>
          <SelectField label="Where do you live" name="country" required defaultValue="">
            <option value="" disabled>
              Choose a country
            </option>
            {COUNTRIES.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </SelectField>
          <Button type="submit" disabled={busy}>
            continue
          </Button>
        </form>
      )}

      {step === 'blocked' && (
        <div className="flex flex-col gap-5">
          <Notice>Accounts are not available here, but you can still play.</Notice>
          <p className="text-copy text-envy">The daily challenge, the gallery and game recommendations are open to everyone, with no sign-in.</p>
          <div className="flex flex-wrap gap-4">
            <Button href="/daily">today&apos;s challenge</Button>
            <Button href="/gallery" variant="ghost">
              play the gallery
            </Button>
          </div>
        </div>
      )}

      {step === 'email' && (
        <form onSubmit={onEmail} className="flex flex-col gap-5" aria-label="Sign in">
          <TextField label="Email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" hint={supabaseConfig ? 'We will email you a sign-in link. No password.' : 'Local development: signs you in without sending an email.'} />
          <Button type="submit" disabled={busy}>
            {supabaseConfig ? 'send my link' : 'sign in'}
          </Button>
        </form>
      )}

      {step === 'check-email' && <Notice tone="success">Check your email for the sign-in link. You can close this tab.</Notice>}

      {step === 'profile' && (
        <form onSubmit={onProfile} className="flex flex-col gap-5" aria-label="Your profile">
          {isAdult ? (
            <TextField label="Display name" name="displayName" required minLength={2} maxLength={24} hint="Shown on the leaderboard and next to games you publish." />
          ) : (
            <Notice>We will give you a friendly nickname. Nicknames are shown instead of names for everyone under 18.</Notice>
          )}
          <Button type="submit" disabled={busy}>
            finish
          </Button>
        </form>
      )}

      {error ? <Notice tone="error">{error}</Notice> : null}

      <p className="text-base text-envy">
        By continuing you agree to the <Link className="text-gold underline-offset-4 hover:underline" href="/legal/terms">Terms</Link> and the{' '}
        <Link className="text-gold underline-offset-4 hover:underline" href="/legal/privacy">Privacy Policy</Link>. Parents, see{' '}
        <Link className="text-gold underline-offset-4 hover:underline" href="/parents">how we handle kids, ads and data</Link>.
      </p>
    </div>
  );
}
