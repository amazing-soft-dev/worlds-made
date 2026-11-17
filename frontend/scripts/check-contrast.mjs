// Checks that the text colours used on the site keep WCAG AA contrast (4.5:1 for normal text) against the
// backgrounds they sit on. Colours are read from the @theme block in src/app/globals.css, so a token change
// that breaks contrast fails CI.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(fileURLToPath(new URL('../src/app/globals.css', import.meta.url)), 'utf8');
const colors = Object.fromEntries([...css.matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]));

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lin = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex) => {
  const [r, g, b] = rgb(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [foreground token, background token, where it is used]
const PAIRS = [
  ['ink', 'bg', 'body text'],
  ['envy', 'bg', 'secondary text and placeholders'],
  ['gold', 'bg', 'headings, links and eyebrows'],
  ['gold-mid', 'bg', 'chips'],
  ['danger', 'bg', 'error messages'],
  ['emerald', 'bg', 'success messages and free labels'],
  ['bg', 'gold', 'primary button text'],
  ['ink', 'surface', 'text on the player surface'],
];

const failures = [];
for (const [fg, bg, use] of PAIRS) {
  if (!colors[fg] || !colors[bg]) {
    failures.push(`token missing: ${fg} or ${bg}`);
    continue;
  }
  const r = ratio(colors[fg], colors[bg]);
  const line = `${fg} on ${bg}: ${r.toFixed(2)}:1 (${use})`;
  if (r < 4.5) failures.push(line);
  else console.log(`ok   ${line}`);
}

if (failures.length) {
  console.error('check:a11y failed (needs 4.5:1):\n - ' + failures.join('\n - '));
  process.exit(1);
}
console.log(`check:a11y ok: ${PAIRS.length} colour pairs meet WCAG AA.`);
