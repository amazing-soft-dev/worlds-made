import type { ReactNode } from 'react';
import { Reveal } from '@/components/motion/Reveal';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/Eyebrow';
import type { Site } from '@/content/site';

type Props = {
  feature: Site['features'][number];
  /** A <Photo slot="..."> written by the page, so each photo's single use is visible to check:images. */
  photo: ReactNode;
  flip?: boolean;
};

/** Image and text side by side on desktop (alternating), stacked below. */
export function Feature({ feature, photo, flip = false }: Props) {
  return (
    <Reveal>
      <article
        id={feature.id}
        className={`flex flex-col gap-10 desktop:h-[544px] desktop:gap-9 ${flip ? 'desktop:flex-row-reverse' : 'desktop:flex-row'}`}
      >
        <div className="relative aspect-[350/337] w-full border border-line desktop:aspect-auto desktop:h-[544px] desktop:w-[557px] desktop:flex-none">
          {photo}
        </div>
        <div className="flex flex-col justify-between gap-7 desktop:w-[487px] desktop:flex-none">
          <div className="flex flex-col gap-3.5">
            <Eyebrow>{feature.eyebrow}</Eyebrow>
            <h3 className="font-display text-h3 tablet:text-[44px] tablet:leading-[70px]">{feature.title}</h3>
            <p className="text-copy text-envy">{feature.text}</p>
          </div>
          <div>
            <Button href={feature.href}>{feature.cta} →</Button>
          </div>
        </div>
      </article>
    </Reveal>
  );
}
