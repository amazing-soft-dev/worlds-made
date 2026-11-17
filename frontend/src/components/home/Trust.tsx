import type { ReactNode } from 'react';
import { Reveal } from '@/components/motion/Reveal';
import { Card } from '@/components/ui/Card';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { site } from '@/content/site';

/** Safety promises under a photo band, so parents see them before anything else. */
export function Trust({ photo }: { photo: ReactNode }) {
  return (
    <section id="safety" className="px-5 py-20 tablet:px-10">
      <div className="mx-auto max-w-[1080px]">
        <Reveal>
          <SectionTitle eyebrow="Built for everyone" title="Safe by design" />
        </Reveal>
        <div className="relative mt-14 h-[200px] border border-line tablet:h-[260px]">{photo}</div>
        <ul className="mt-10 grid gap-5 tablet:grid-cols-3">
          {site.trust.map((t) => (
            <li key={t.title}>
              <Card className="flex h-full flex-col gap-3">
                <h3 className="font-display text-base tracking-button text-gold">{t.title}</h3>
                <p className="text-copy text-envy">{t.text}</p>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
