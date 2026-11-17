import { Faq } from '@/components/home/Faq';
import { Feature } from '@/components/home/Feature';
import { FinalCta } from '@/components/home/FinalCta';
import { Hero } from '@/components/home/Hero';
import { Steps } from '@/components/home/Steps';
import { Trust } from '@/components/home/Trust';
import { Photo } from '@/components/Photo';
import { site } from '@/content/site';

const featureSizes = '(min-width: 1200px) 557px, 100vw';

// Photos are written out here, one per slot, so check:images can see that each is used once.
const featurePhotos = {
  create: <Photo slot="create" sizes={featureSizes} />,
  daily: <Photo slot="daily" sizes={featureSizes} />,
  gallery: <Photo slot="gallery" sizes={featureSizes} />,
  recommend: <Photo slot="recommend" sizes={featureSizes} />,
} as const;

export default function Home() {
  return (
    <>
      <Hero />
      <Steps />
      <section id="features" className="px-5 py-20 tablet:px-10">
        <div className="mx-auto flex max-w-[1080px] flex-col gap-[140px] desktop:gap-[90px]">
          {site.features.map((feature, i) => (
            <Feature key={feature.id} feature={feature} photo={featurePhotos[feature.id]} flip={i % 2 === 1} />
          ))}
        </div>
      </section>
      <Trust photo={<Photo slot="sealed" sizes="(min-width: 1200px) 1080px, 100vw" />} />
      <Faq />
      <FinalCta />
    </>
  );
}
