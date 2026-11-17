import type { Metadata } from 'next';
import { RecommendView } from '@/components/recommend/RecommendView';
import { SectionTitle } from '@/components/ui/SectionTitle';

export const metadata: Metadata = {
  title: 'Find a game to play',
  description: 'Tell us what you feel like playing and we will suggest real games, free and paid, with a line on why each fits.',
};

export default function RecommendPage() {
  return (
    <div className="px-5 py-16 tablet:px-10">
      <div className="mx-auto flex max-w-[1080px] flex-col gap-12">
        <SectionTitle as="h1" eyebrow="Find something to play" title="Game recommendations" description="Describe what you are in the mood for. No account needed." />
        <RecommendView />
      </div>
    </div>
  );
}
