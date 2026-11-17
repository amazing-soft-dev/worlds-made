import { ageBandFromBirthYear, MIN_AGE_BY_REGION, type AgeBand } from '@worlds-made/shared';

/** EEA members plus the UK: GDPR Article 8 lets states set the age of digital consent anywhere from 13 to 16. V1 requires 16+. */
export const REGIONS_16_PLUS: ReadonlySet<string> = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB',
]);

export function minAccountAge(country: string | null | undefined): number {
  return country && REGIONS_16_PLUS.has(country.toUpperCase()) ? MIN_AGE_BY_REGION.eea : MIN_AGE_BY_REGION.default;
}

export interface AgeAnswer {
  birthYear: number;
  country: string | null;
  band: AgeBand;
  /** Under-13s never get an account in V1, and EEA/UK visitors need to be 16 or older. */
  canHaveAccount: boolean;
}

/** Uses the youngest age consistent with the birth year, so a child is never treated as older than they may be. */
export function evaluateAge(birthYear: number, country: string | null | undefined, now: Date = new Date()): AgeAnswer {
  const youngest = now.getUTCFullYear() - birthYear - 1;
  const c = country ? country.toUpperCase() : null;
  return { birthYear, country: c, band: ageBandFromBirthYear(birthYear, now), canHaveAccount: youngest >= minAccountAge(c) };
}
