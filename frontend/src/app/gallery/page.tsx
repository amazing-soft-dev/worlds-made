import type { Metadata } from 'next';
import { GalleryView } from '@/components/game/GalleryView';
import { SectionTitle } from '@/components/ui/SectionTitle';

export const metadata: Metadata = {
  title: 'Gallery',
  description: 'Play games made by the community: new, most liked this week, and staff picks.',
};

export default function GalleryPage() {
  return (
    <div className="px-5 py-16 tablet:px-10">
      <div className="mx-auto flex max-w-[1080px] flex-col gap-12">
        <SectionTitle
          as="h1"
          eyebrow="The community gallery"
          title="Play what others made"
          description="Anyone can play. Sign in to like a game. Every game has a report button, and every game shows its licence."
        />
        <GalleryView />
      </div>
    </div>
  );
}
