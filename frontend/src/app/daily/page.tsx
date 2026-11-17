import type { Metadata } from 'next';
import { DailyView } from '@/components/daily/DailyView';
import { SectionTitle } from '@/components/ui/SectionTitle';

export const metadata: Metadata = {
  title: 'Daily challenge',
  description: 'One short game a day, the same for everyone, with a streak and a leaderboard.',
};

export default function DailyPage() {
  return (
    <div className="px-5 py-16 tablet:px-10">
      <div className="mx-auto flex max-w-[1080px] flex-col gap-12">
        <SectionTitle as="h1" eyebrow="Every day at 00:00 UTC" title="The daily challenge" description="Everyone plays the same game. Keep your streak alive and climb the board. You do not need an account to play." />
        <DailyView />
      </div>
    </div>
  );
}
