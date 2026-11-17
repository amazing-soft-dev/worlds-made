import { createHash } from 'node:crypto';

const ADJECTIVES = ['Swift', 'Brave', 'Sunny', 'Clever', 'Calm', 'Bright', 'Lucky', 'Nimble', 'Cosmic', 'Mighty', 'Gentle', 'Witty'];
const NOUNS = ['Otter', 'Comet', 'Lantern', 'Falcon', 'Maple', 'Pixel', 'Rocket', 'Willow', 'Badger', 'Harbor', 'Ember', 'Quill'];

/**
 * A friendly, always-safe nickname. Accounts under 18 use one of these instead of a chosen name, so
 * leaderboards and the gallery never show free text from minors. Stable for the same seed.
 */
export function generateNickname(seed: string): string {
  const h = createHash('sha256').update(seed).digest();
  const adjective = ADJECTIVES[h[0]! % ADJECTIVES.length]!;
  const noun = NOUNS[h[1]! % NOUNS.length]!;
  const n = 10 + (h[2]! % 90);
  return `${adjective}${noun}${n}`;
}
