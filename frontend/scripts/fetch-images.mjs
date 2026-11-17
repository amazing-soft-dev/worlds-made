// Downloads every photo in images.manifest.json into public/images/src/.
//   node scripts/fetch-images.mjs          download missing files
//   node scripts/fetch-images.mjs --force  download everything again
// The downloaded sources are committed; this script exists so the set can be reproduced and audited.
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('images.manifest.json', root), 'utf8'));
const outDir = fileURLToPath(new URL('public/images/src/', root));
const force = process.argv.includes('--force');
mkdirSync(outDir, { recursive: true });

/** Direct CDN URLs: Unsplash images.unsplash.com/<photo-id>, Pexels images.pexels.com/photos/<id>/pexels-photo-<id>.jpeg. */
function downloadUrl(p) {
  if (p.source === 'unsplash') return `https://images.unsplash.com/${p.sourceId}?auto=format&fit=max&w=1600&q=72&fm=jpg`;
  if (p.source === 'pexels') return `https://images.pexels.com/photos/${p.sourceId}/pexels-photo-${p.sourceId}.jpeg?auto=compress&cs=tinysrgb&w=1600`;
  throw new Error(`unknown source ${p.source} for ${p.slot}`);
}

let failed = 0;
for (const p of manifest.photos) {
  const target = outDir + p.file;
  if (existsSync(target) && !force) {
    console.log(`skip   ${p.file} (exists)`);
    continue;
  }
  try {
    const res = await fetch(downloadUrl(p), { redirect: 'follow' });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !type.startsWith('image/')) throw new Error(`HTTP ${res.status} ${type}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
    if (!isJpeg || buf.length < 20_000) throw new Error(`not a usable JPEG (${buf.length} bytes)`);
    writeFileSync(target, buf);
    console.log(`ok     ${p.file} ${(buf.length / 1024).toFixed(0)} KB  ${p.pageUrl}`);
  } catch (err) {
    failed++;
    console.error(`FAILED ${p.file}: ${err.message}`);
  }
}
process.exit(failed ? 1 : 0);
