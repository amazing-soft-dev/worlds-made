import { Reveal } from '@/components/motion/Reveal';
import { Photo } from '@/components/Photo';
import { Card } from '@/components/ui/Card';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { site } from '@/content/site';

/** Five numbered cards under a photo band: describe, build, play, share, return. */
export function Steps() {
  return (
    <section id="how" className="px-5 py-20 tablet:px-10">
      <div className="mx-auto max-w-[1080px]">
        <Reveal>
          <SectionTitle eyebrow="How it works" title="Five steps from idea to play" />
        </Reveal>
        <div className="relative mt-14 h-[200px] border border-line tablet:h-[260px]">
          <Photo slot="steps" sizes="(min-width: 1200px) 1080px, 100vw" />
        </div>
        <ol className="mt-10 grid gap-5 tablet:grid-cols-2 desktop:grid-cols-5">
          {site.steps.map((step) => (
            <li key={step.n}>
              <Card className="flex h-full flex-col gap-3 p-6">
                <span className="font-display text-base tracking-button text-gold">{step.n}</span>
                <h3 className="font-display text-base tracking-button">{step.title}</h3>
                <p className="text-base leading-7 text-envy">{step.text}</p>
              </Card>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
