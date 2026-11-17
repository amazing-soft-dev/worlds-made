// Verifies the static export (NEXT_OUTPUT=export). Expanded in the static-export checks issue.
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('../out/', import.meta.url));
const required = ['index.html', '404.html'];
const problems = [];

for (const f of required) {
  if (!existsSync(out + f)) problems.push(`missing out/${f}`);
}
// A static site has no server: the API must not be exported.
if (existsSync(out + 'api')) problems.push('out/api exists, but the static build must not contain /api');
if (existsSync(out + 'index.html') && statSync(out + 'index.html').size < 200) problems.push('out/index.html is suspiciously small');

if (problems.length) {
  console.error('check:static failed:\n - ' + problems.join('\n - '));
  process.exit(1);
}
console.log('check:static ok: ' + required.join(', ') + ' present, no out/api.');
