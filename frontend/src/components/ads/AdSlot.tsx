'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { adsEnabled, adTreatment, type AdTreatment } from '@/lib/ad-treatment';
import { useAuth } from '@/lib/auth';
import type { AgeState } from '@/lib/types';

declare global {
  interface Window {
    adsbygoogle?: unknown[] & { requestNonPersonalizedAds?: number };
  }
}

const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? '';
const enabled = adsEnabled({ NODE_ENV: process.env.NODE_ENV, NEXT_PUBLIC_ADS_ENABLED: process.env.NEXT_PUBLIC_ADS_ENABLED, NEXT_PUBLIC_ADSENSE_CLIENT: client });

/**
 * One ad unit. Renders nothing unless ads are enabled in production, and never loads the ad script before the
 * visitor's age is known, so an unknown age is always treated as a child's. Never placed next to a game frame.
 */
export function AdSlot() {
  const slot = process.env.NEXT_PUBLIC_ADSENSE_SLOT ?? '';
  const { status, me } = useAuth();
  const [treatment, setTreatment] = useState<AdTreatment | null>(null);

  useEffect(() => {
    if (!enabled || status === 'loading') return;
    let cancelled = false;
    void (async () => {
      const band = me?.profile?.age_band ?? (await api<AgeState>('/age').catch(() => null))?.band ?? null;
      if (!cancelled) setTreatment(adTreatment(band));
    })();
    return () => {
      cancelled = true;
    };
  }, [status, me]);

  useEffect(() => {
    if (!treatment) return;
    const list = (window.adsbygoogle ??= [] as unknown as NonNullable<Window['adsbygoogle']>);
    list.requestNonPersonalizedAds = 1;
    list.push({});
  }, [treatment]);

  if (!enabled || !treatment) return null;

  return (
    <aside aria-label="Advertisement" className="mx-auto w-full max-w-[728px] text-center">
      <p className="mb-1 text-eyebrow uppercase tracking-eyebrow text-envy">Advertisement</p>
      <Script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`} crossOrigin="anonymous" strategy="afterInteractive" />
      <ins
        className="adsbygoogle block"
        style={{ display: 'block' }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-npa="1"
        {...(treatment.childDirected ? { 'data-tag-for-child-directed-treatment': '1' } : {})}
        {...(treatment.underAgeOfConsent ? { 'data-tag-for-under-age-of-consent': '1' } : {})}
      />
    </aside>
  );
}
