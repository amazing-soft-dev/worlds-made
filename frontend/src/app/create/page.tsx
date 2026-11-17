import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CreateStudio } from '@/components/game/CreateStudio';
import { SectionTitle } from '@/components/ui/SectionTitle';

export const metadata: Metadata = {
  title: 'Make a game',
  description: 'Describe a game in your own words and play it in a minute.',
};

export default function CreatePage() {
  return (
    <div className="px-5 py-16 tablet:px-10">
      <div className="mx-auto flex max-w-[1080px] flex-col gap-12">
        <SectionTitle as="h1" eyebrow="The game maker" title="Describe it. Play it." description="Tell us the game you imagine. We build it as one small, original, playable game." />
        <Suspense fallback={<p className="text-copy text-envy">Loading…</p>}>
          <CreateStudio />
        </Suspense>
      </div>
    </div>
  );
}
