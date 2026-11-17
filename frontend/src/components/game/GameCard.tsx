import { LICENSE_LABELS } from '@worlds-made/shared';
import Link from 'next/link';
import { Chip } from '@/components/ui/Chip';
import type { GalleryItem } from '@/lib/types';

/** A stable hue from the title, so each game gets its own colour without needing a thumbnail. */
function hueFor(text: string): number {
  let h = 0;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export function GameCard({ game }: { game: GalleryItem }) {
  const hue = hueFor(game.title);
  return (
    <article className="flex flex-col border border-line bg-bg transition-colors duration-200 ease-site hover:border-gold-mid">
      <Link href={`/play/${game.id}`} className="group flex flex-1 flex-col focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
        <div
          aria-hidden
          className="grid aspect-[4/3] place-items-center border-b border-line"
          style={{ background: `linear-gradient(135deg, hsl(${hue} 45% 14%), hsl(${(hue + 50) % 360} 55% 24%))` }}
        >
          <span className="font-display text-h3 text-gold/80 transition-transform duration-200 group-hover:scale-110">▶</span>
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <h3 className="font-display text-base tracking-button">{game.title}</h3>
          <p className="text-base text-envy">by {game.creator}</p>
          {game.description ? <p className="text-base">{game.description}</p> : null}
          <div className="mt-auto flex flex-wrap gap-2 pt-2">
            {game.staffPick ? <Chip className="border-gold text-gold">staff pick</Chip> : null}
            {game.tags.slice(0, 3).map((t) => (
              <Chip key={t}>{t}</Chip>
            ))}
          </div>
        </div>
      </Link>
      <div className="flex items-center justify-between border-t border-line px-4 py-2 text-base text-envy">
        <span aria-label={`${game.likeCount} likes`}>♥ {game.likeCount}</span>
        <span title={LICENSE_LABELS[game.license]}>{game.license === 'all-rights-reserved' ? '© all rights reserved' : game.license.toUpperCase()}</span>
      </div>
    </article>
  );
}
