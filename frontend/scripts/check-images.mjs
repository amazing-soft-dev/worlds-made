// Placeholder gate: each photo may be used once. The real manifest check lands with the check:images issue.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const manifest = fileURLToPath(new URL('../images.manifest.json', import.meta.url));
if (!existsSync(manifest)) {
  console.log('check:images: no images.manifest.json yet, nothing to check.');
  process.exit(0);
}
console.log('check:images: manifest present but the full check is not implemented yet.');
