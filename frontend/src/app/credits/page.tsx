import type { Metadata } from 'next';
import { SectionTitle } from '@/components/ui/SectionTitle';
import manifest from '../../../images.manifest.json';

export const metadata: Metadata = {
  title: 'Credits',
  description: 'Photographers, typefaces and data sources used on Worlds Made.',
};

const linkClass = 'text-gold underline-offset-4 hover:underline';

export default function CreditsPage() {
  return (
    <div className="px-5 py-16 tablet:px-10">
      <div className="mx-auto flex max-w-[820px] flex-col gap-14">
        <SectionTitle as="h1" eyebrow="Thank you" title="Credits" />

        <section aria-labelledby="photos">
          <h2 id="photos" className="font-display text-h3">
            Photographs
          </h2>
          <p className="mt-3 text-copy text-envy">
            Every photo comes from Unsplash under the Unsplash licence. Attribution is not required; we give it anyway.
          </p>
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {manifest.photos.map((p) => (
              <li key={p.slot} className="flex flex-col gap-1 py-4 tablet:flex-row tablet:justify-between">
                <span className="text-copy">{p.alt}</span>
                <span className="text-base text-envy">
                  <a className={linkClass} href={p.pageUrl} rel="noopener noreferrer" target="_blank">
                    photo
                  </a>{' '}
                  by{' '}
                  <a className={linkClass} href={p.authorUrl} rel="noopener noreferrer" target="_blank">
                    @{p.author}
                  </a>{' '}
                  on Unsplash
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="type">
          <h2 id="type" className="font-display text-h3">
            Typefaces
          </h2>
          <p className="mt-3 text-copy text-envy">
            Cinzel and EB Garamond, both under the SIL Open Font License, served from our own domain through next/font.
          </p>
        </section>

        <section aria-labelledby="data">
          <h2 id="data" className="font-display text-h3">
            Game data
          </h2>
          <p className="mt-3 text-copy text-envy">
            Game recommendations use data from{' '}
            <a className={linkClass} href="https://rawg.io" rel="noopener noreferrer" target="_blank">
              RAWG
            </a>
            . Some store links are affiliate links. We are not affiliated with RAWG, Steam, Poki or itch.io.
          </p>
        </section>
      </div>
    </div>
  );
}
