import { z } from 'zod';

export const ageBandSchema = z.enum(['under13', '13to17', 'adult']);
export type AgeBand = z.infer<typeof ageBandSchema>;

/**
 * Only the birth year is stored, so the exact age is unknown. We assume the
 * youngest possible age for that year (current year - birth year - 1) so a
 * child is never treated as older than they might be.
 */
export function ageBandFromBirthYear(birthYear: number, now: Date = new Date()): AgeBand {
  const youngest = now.getUTCFullYear() - birthYear - 1;
  if (youngest < 13) return 'under13';
  if (youngest < 18) return '13to17';
  return 'adult';
}

/** Unknown age is treated as under 13 (limited ratings, child ad treatment, no account). */
export function effectiveAgeBand(band: AgeBand | null | undefined): AgeBand {
  return band ?? 'under13';
}

export const birthYearSchema = z.number().int().min(1900).max(new Date().getUTCFullYear());
