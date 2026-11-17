// Builds responsive WebP files for the static export (NEXT_OUTPUT=export), where there is no image optimizer.
//   public/images/src/<name>.jpg  ->  public/images/w640|w1080|w1600/<name>.webp
// The custom loader in src/lib/image-loader.ts points <Image> at these files. Output is git-ignored.
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

export const WIDTHS = [640, 1080, 1600];
const src = fileURLToPath(new URL('../public/images/src/', import.meta.url));
const out = fileURLToPath(new URL('../public/images/', import.meta.url));

if (!existsSync(src)) {
  console.log('images: no source photos yet, nothing to convert.');
  process.exit(0);
}

const files = readdirSync(src).filter((f) => /\.(jpe?g|png)$/i.test(f));
let written = 0;
let skipped = 0;
for (const w of WIDTHS) mkdirSync(`${out}w${w}`, { recursive: true });

for (const file of files) {
  const name = file.replace(/\.[^.]+$/, '');
  for (const w of WIDTHS) {
    const target = `${out}w${w}/${name}.webp`;
    // Skip work that is already up to date, so CI and local runs stay quick.
    if (existsSync(target) && statSync(target).mtimeMs >= statSync(src + file).mtimeMs) {
      skipped++;
      continue;
    }
    await sharp(src + file).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toFile(target);
    written++;
  }
}
console.log(`images: ${files.length} photos -> ${written} written, ${skipped} up to date (widths ${WIDTHS.join(', ')}).`);
