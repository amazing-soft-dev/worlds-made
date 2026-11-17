import { Button } from '@/components/ui/Button';
import { SectionTitle } from '@/components/ui/SectionTitle';

/** Closing call to action with the gold ornament used in the design. */
export function FinalCta() {
  return (
    <section id="start" className="px-5 py-[100px] tablet:px-10 desktop:py-[150px]">
      <div className="mx-auto flex max-w-[1080px] flex-col items-center gap-6 text-center">
        <div aria-hidden className="flex h-[11px] w-[159px] items-center gap-3.5">
          <span className="h-px flex-1 bg-gold-mid" />
          <span className="size-2 rotate-45 border border-gold-mid" />
          <span className="h-px flex-1 bg-gold-mid" />
        </div>
        <SectionTitle title="Make something today" description="Free to start. No account needed to play." />
        <Button href="/create">make a game</Button>
      </div>
    </section>
  );
}
