/**
 * Starter blocklist, by category. It is deliberately short and public: a trust-and-safety reviewer must extend it
 * (slurs and hate terms are not committed here) by setting MODERATION_EXTRA_TERMS, a comma-separated list.
 * Matching works on normalised text, so casing, accents, punctuation and common letter swaps do not dodge it.
 */
export const BLOCKLIST = {
  adult: ['porn', 'porno', 'nude', 'nudes', 'naked', 'nsfw', 'xxx', 'sex', 'sexy', 'erotic', 'fetish', 'hentai', 'onlyfans', 'strip club'],
  violence: ['gore', 'gory', 'dismember', 'dismemberment', 'beheading', 'decapitation', 'torture', 'massacre', 'suicide', 'self harm'],
  // Real people: named public figures are not allowed as characters.
  realPeople: ['donald trump', 'joe biden', 'barack obama', 'elon musk', 'taylor swift', 'kim kardashian', 'vladimir putin', 'kanye west'],
} as const;

export type BlockCategory = keyof typeof BLOCKLIST | 'extra';

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' };

/** Lower-case, strip accents, undo common letter swaps, and turn everything else into single spaces. */
export function normalise(text: string): string {
  const base = text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const swapped = [...base].map((c) => LEET[c] ?? c).join('');
  return ` ${swapped.replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim()} `;
}

export interface BlockHit {
  category: BlockCategory;
  term: string;
}

export function findBlocked(text: string, extraTerms: readonly string[] = []): BlockHit | null {
  const haystack = normalise(text);
  const lists: Array<[BlockCategory, readonly string[]]> = [
    ['adult', BLOCKLIST.adult],
    ['violence', BLOCKLIST.violence],
    ['realPeople', BLOCKLIST.realPeople],
    ['extra', extraTerms.map((t) => t.trim().toLowerCase()).filter(Boolean)],
  ];
  for (const [category, terms] of lists) {
    for (const term of terms) {
      if (haystack.includes(` ${normalise(term).trim()} `)) return { category, term };
    }
  }
  return null;
}
