// Placeholder for the static-export image step (sharp -> responsive WebP). Implemented in the WebP pipeline issue.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const sources = fileURLToPath(new URL('../public/images/src', import.meta.url));
if (!existsSync(sources)) {
  console.log('images: no source photos yet, nothing to convert.');
  process.exit(0);
}
console.log('images: source photos found but the WebP pipeline is not implemented yet.');
