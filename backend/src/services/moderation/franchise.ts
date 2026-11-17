/**
 * Requests that name a franchise are not refused: they are rewritten to an original stand-in and the user is told.
 * Genres and mechanics are fine to ask for ("match-3", "runner"); names, characters, logos and levels are not.
 */
const STAND_INS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\b(super\s+)?mario(\s+bros\.?)?\b|\bluigi\b/gi, replacement: 'a jumping plumber-style hero, original design' },
  { pattern: /\bpok[eé]mon\b|\bpikachu\b/gi, replacement: 'an original creature-collecting adventure with brand-new monsters' },
  { pattern: /\bsonic(\s+the\s+hedgehog)?\b/gi, replacement: 'a fast spiky-haired runner, original design' },
  { pattern: /\bzelda\b/gi, replacement: 'an original hero-explores-a-kingdom adventure' },
  { pattern: /\bminecraft\b/gi, replacement: 'an original blocky sandbox world' },
  { pattern: /\bfortnite\b/gi, replacement: 'an original colourful team arena' },
  { pattern: /\bpac[\s-]?man\b/gi, replacement: 'an original maze chase with a hungry round hero' },
  { pattern: /\btetris\b/gi, replacement: 'an original falling-blocks puzzle' },
  { pattern: /\bflappy\s+bird\b/gi, replacement: 'an original one-button flapping game' },
  { pattern: /\bangry\s+birds\b/gi, replacement: 'an original slingshot physics puzzle' },
  { pattern: /\bamong\s+us\b/gi, replacement: 'an original space-crew mystery' },
  { pattern: /\bsubway\s+surfers?\b/gi, replacement: 'an original lane-switching runner' },
  { pattern: /\bcandy\s+crush\b/gi, replacement: 'an original match-three puzzle' },
  { pattern: /\bdisney\b|\bmickey\s+mouse\b/gi, replacement: 'an original cartoon world' },
];

export interface Swap {
  from: string;
  to: string;
}

export function rewriteFranchises(prompt: string): { text: string; swaps: Swap[] } {
  const swaps: Swap[] = [];
  let text = prompt;
  for (const { pattern, replacement } of STAND_INS) {
    text = text.replace(pattern, (match) => {
      swaps.push({ from: match, to: replacement });
      return replacement;
    });
  }
  return { text, swaps };
}
