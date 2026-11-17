import type { AgeBand } from '@worlds-made/shared';

export interface AdTreatment {
  /** Tag the ad request as child-directed. Turns off personalised ads and third-party ad vendors (spec: TFAT = 1). */
  childDirected: boolean;
  /** Tag the request as from a user under the age of consent (spec: TFAT = 2, teens 13 to 17). */
  underAgeOfConsent: boolean;
  /** V1 never personalises ads for anyone: there is no consent banner and no cross-site tracking. */
  nonPersonalized: true;
}

/**
 * The single place that decides how ads are tagged. Under 13 and unknown ages are treated as children;
 * teens get the under-age-of-consent tag; adults still get non-personalised ads in V1.
 * Verify the exact AdSense tag names against current documentation before enabling ads (docs/KIDS-COMPLIANCE.md).
 */
export function adTreatment(band: AgeBand | null | undefined): AdTreatment {
  if (band === 'adult') return { childDirected: false, underAgeOfConsent: false, nonPersonalized: true };
  if (band === '13to17') return { childDirected: false, underAgeOfConsent: true, nonPersonalized: true };
  return { childDirected: true, underAgeOfConsent: false, nonPersonalized: true };
}

/** Ads load only in production and only when a publisher id has been configured. */
export function adsEnabled(env: { NODE_ENV?: string; NEXT_PUBLIC_ADS_ENABLED?: string; NEXT_PUBLIC_ADSENSE_CLIENT?: string }): boolean {
  return env.NODE_ENV === 'production' && env.NEXT_PUBLIC_ADS_ENABLED === 'true' && /^ca-pub-\d+$/.test(env.NEXT_PUBLIC_ADSENSE_CLIENT ?? '');
}
