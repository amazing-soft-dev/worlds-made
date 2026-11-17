// Custom image loader used only by the static export (see next.config.ts).
// Maps /images/src/<name>.jpg to the closest pre-built WebP: /images/w{640|1080|1600}/<name>.webp.
const WIDTHS = [640, 1080, 1600] as const;

export default function imageLoader({ src, width }: { src: string; width: number; quality?: number }): string {
  const name = (src.split('/').pop() ?? src).replace(/\.[^.]+$/, '');
  const w = WIDTHS.find((candidate) => candidate >= width) ?? WIDTHS[WIDTHS.length - 1];
  return `/images/w${w}/${name}.webp`;
}
