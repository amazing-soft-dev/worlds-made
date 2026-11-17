// Each photo may be used exactly once.
//   - manifest slots, files and source ids are unique
//   - every manifest file exists in public/images/src and nothing else is in that folder
//   - every <Photo slot="..."> in src/ names a manifest slot, and no slot is used twice
// Unused slots are warnings until the pages exist; set IMAGES_STRICT=1 to make them errors.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifestPath = join(root, 'images.manifest.json');
if (!existsSync(manifestPath)) {
  console.log('check:images: no images.manifest.json yet, nothing to check.');
  process.exit(0);
}

const { photos } = JSON.parse(readFileSync(manifestPath, 'utf8'));
const errors = [];
const warnings = [];

const dupes = (key) => {
  const seen = new Set();
  for (const p of photos) {
    if (seen.has(p[key])) errors.push(`duplicate ${key}: ${p[key]}`);
    seen.add(p[key]);
  }
};
['slot', 'file', 'sourceId'].forEach(dupes);

for (const p of photos) {
  for (const f of ['slot', 'file', 'source', 'sourceId', 'pageUrl', 'author', 'authorUrl', 'alt']) {
    if (!p[f]) errors.push(`${p.slot ?? '?'}: missing "${f}"`);
  }
  if (!existsSync(join(root, 'public/images/src', p.file))) errors.push(`${p.slot}: public/images/src/${p.file} is missing`);
}

const srcDir = join(root, 'public/images/src');
if (existsSync(srcDir)) {
  const listed = new Set(photos.map((p) => p.file));
  for (const f of readdirSync(srcDir)) if (!listed.has(f)) errors.push(`public/images/src/${f} is not in the manifest`);
}

// Count slot usages in the app source.
const uses = new Map();
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(tsx|ts)$/.test(name)) {
      const text = readFileSync(full, 'utf8');
      for (const m of text.matchAll(/<Photo\b[^>]*?\bslot="([a-z0-9-]+)"/g)) {
        const arr = uses.get(m[1]) ?? [];
        arr.push(full.replace(root, ''));
        uses.set(m[1], arr);
      }
    }
  }
}
walk(join(root, 'src'));

const slots = new Set(photos.map((p) => p.slot));
for (const [slot, where] of uses) {
  if (!slots.has(slot)) errors.push(`slot "${slot}" is used in ${where[0]} but is not in the manifest`);
  else if (where.length > 1) errors.push(`photo "${slot}" is used ${where.length} times: ${where.join(', ')}`);
}
for (const slot of slots) if (!uses.has(slot)) warnings.push(`photo "${slot}" is in the manifest but not used yet`);

if (process.env.IMAGES_STRICT === '1') errors.push(...warnings.splice(0).map((w) => `${w} (strict)`));
for (const w of warnings) console.warn(`check:images warning: ${w}`);
if (errors.length) {
  console.error('check:images failed:\n - ' + errors.join('\n - '));
  process.exit(1);
}
console.log(`check:images ok: ${photos.length} photos, ${uses.size} used, each at most once.`);
