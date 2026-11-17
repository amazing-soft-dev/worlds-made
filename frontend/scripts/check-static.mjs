// Verifies the static export (NEXT_OUTPUT=export) in out/:
//   - HTML for every route in the sitemap, plus 404.html
//   - sitemap.xml, robots.txt, llms.txt and the favicon
//   - every manifest photo as 640/1080/1600 WebP
//   - no out/api, because a static site has no server and forms cannot send email
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = root + 'out/';
const problems = [];
const need = (path, label = path) => {
  if (!existsSync(out + path)) problems.push(`missing out/${label}`);
};

if (!existsSync(out)) {
  console.error('check:static failed: out/ does not exist. Run the build with NEXT_OUTPUT=export first.');
  process.exit(1);
}

need('index.html');
need('404.html');
for (const f of ['sitemap.xml', 'robots.txt', 'llms.txt', 'icon.svg', 'opengraph-image']) need(f);
if (existsSync(out + 'index.html') && statSync(out + 'index.html').size < 200) problems.push('out/index.html is suspiciously small');

// Every sitemap URL must exist as a page.
if (existsSync(out + 'sitemap.xml')) {
  const xml = readFileSync(out + 'sitemap.xml', 'utf8');
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  if (paths.length === 0) problems.push('sitemap.xml lists no pages');
  for (const p of paths) {
    const file = p === '/' ? 'index.html' : p.replace(/^\/|\/$/g, '') + '/index.html';
    need(file, `${file} (listed in sitemap.xml)`);
  }
}

const manifestPath = root + 'images.manifest.json';
if (existsSync(manifestPath)) {
  const { photos } = JSON.parse(readFileSync(manifestPath, 'utf8'));
  for (const p of photos) {
    const name = p.file.replace(/\.[^.]+$/, '');
    for (const w of [640, 1080, 1600]) need(`images/w${w}/${name}.webp`);
  }
}

if (existsSync(out + 'api')) problems.push('out/api exists, but the static build must not contain /api');

if (problems.length) {
  console.error('check:static failed:\n - ' + problems.join('\n - '));
  process.exit(1);
}
console.log('check:static ok: pages from the sitemap, 404, metadata files, responsive WebP, and no out/api.');
