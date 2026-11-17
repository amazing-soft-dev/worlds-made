import Image from 'next/image';
import { cn } from '@/lib/cn';
import manifest from '../../images.manifest.json';

type Props = {
  /** Manifest slot. Written as a string literal so `npm run check:images` can count usages. */
  slot: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
};

/**
 * Fills its nearest positioned parent with a manifest photo. Alt text comes from the manifest,
 * and each photo may be used once (enforced by check:images).
 */
export function Photo({ slot, sizes = '100vw', priority = false, className }: Props) {
  const photo = manifest.photos.find((p) => p.slot === slot);
  if (!photo) throw new Error(`Unknown photo slot "${slot}"`);
  return (
    <Image
      src={`/images/src/${photo.file}`}
      alt={photo.alt}
      fill
      sizes={sizes}
      priority={priority}
      className={cn('object-cover', className)}
    />
  );
}
