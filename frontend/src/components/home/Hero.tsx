import { SlideIn } from '@/components/motion/SlideIn';
import { Photo } from '@/components/Photo';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { site } from '@/content/site';

/**
 * Two columns on desktop (576px text, 504x544 image), stacked below. The text slides in from the
 * left and the image from the right; the section clips the overflow.
 */
export function Hero() {
  const { hero } = site;
  return (
    <section
      id="hero"
      className="overflow-hidden px-5 pb-[120px] pt-[60px] tablet:px-10 tablet:pt-16 desktop:pt-[170px]"
    >
      <div className="mx-auto flex max-w-[1080px] flex-col gap-[104px] desktop:h-[544px] desktop:flex-row desktop:items-center desktop:gap-0">
        <SlideIn
          from="left"
          distance={669}
          className="flex flex-col gap-6 desktop:w-[576px] desktop:flex-none desktop:pr-[60px]"
        >
          <Eyebrow>{hero.eyebrow}</Eyebrow>
          <h1 className="-mt-1.5 font-display text-hero font-bold tracking-[1px] tablet:text-[96px] tablet:leading-[100.8px]">
            {hero.title}
            <em className="block font-body font-medium italic tracking-[-0.02em] text-gold">{hero.accent}</em>
          </h1>
          <p className="max-w-[540px] text-lead">{hero.lead}</p>
          <div className="flex flex-wrap gap-5">
            <Button href={hero.primary.href}>{hero.primary.label}</Button>
            <Button href={hero.secondary.href} variant="ghost">
              {hero.secondary.label}
            </Button>
          </div>
        </SlideIn>

        <SlideIn
          from="right"
          distance={467}
          className="relative aspect-[504/544] w-full max-w-[504px] border border-line desktop:ml-auto"
        >
          <Photo slot="hero" priority sizes="(min-width: 1200px) 504px, 90vw" />
        </SlideIn>
      </div>
    </section>
  );
}
