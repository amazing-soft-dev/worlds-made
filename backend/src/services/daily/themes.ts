import { GENRES, type Genre } from '../games/templates';

/** Themes for generated daily challenges. Wholesome by design; the generator still moderates and scans the result. */
export const THEMES = [
  'Lantern festival', 'Cosmic picnic', 'Snowy mountain village', 'Clockwork garden', 'Deep sea postal service',
  'Moonlight bakery', 'Dragon who is afraid of fire', 'Tiny robot orchestra', 'Rainy day rooftop', 'Treehouse library',
  'Paper boat race', 'Sleepy volcano', 'Firefly lighthouse', 'Marshmallow clouds', 'Jungle drum party',
  'Crystal cave echoes', 'Windmill island', 'Penguin delivery team', 'Starlight train', 'Pumpkin patch parade',
  'Ice cream planet', 'Bouncing seed pods', 'Lost kite rescue', 'Cactus music festival', 'Glow-worm tunnel',
  'Tea party in space', 'Sailing stone boats', 'Autumn leaf swirl', 'Balloon bakery', 'Robot garden helpers',
] as const;

const DAY_MS = 24 * 3600 * 1000;
const dayNumber = (date: string) => Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS);

export function themeFor(date: string): string {
  return THEMES[dayNumber(date) % THEMES.length] as string;
}

/** Rotates through the genres so consecutive days feel different. */
export function genreFor(date: string): Genre {
  return GENRES[dayNumber(date) % GENRES.length] as Genre;
}

/**
 * A sane score range per genre. Scores outside it are rejected: browser code can be faked, so these are
 * generous ceilings for an honest play (a few minutes), not secrets. No prizes in V1.
 */
export const SCORE_RANGES: Record<Genre, { min: number; max: number }> = {
  runner: { min: 0, max: 3000 },
  catcher: { min: 0, max: 1500 },
  shooter: { min: 0, max: 2000 },
  quiz: { min: 0, max: 500 },
};
