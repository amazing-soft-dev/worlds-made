import type { Metadata } from 'next';
import { PlayView } from '@/components/game/PlayView';

export const metadata: Metadata = {
  title: 'Play',
  description: 'Play a game made on Worlds Made.',
};

// Games are looked up by id at request time on the server build. The static export (no server) gets one placeholder page.
export function generateStaticParams() {
  return [{ id: 'demo' }];
}

export default async function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="px-5 py-12 tablet:px-10">
      <div className="mx-auto max-w-[1080px]">
        {id === 'demo' ? <p className="text-lead text-envy">Open a game from the gallery to play it here.</p> : <PlayView id={id} />}
      </div>
    </div>
  );
}
