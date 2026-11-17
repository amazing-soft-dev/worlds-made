import type { ReactNode } from 'react';
import { SectionTitle } from '@/components/ui/SectionTitle';
import type { LegalDoc } from '@/content/legal';

/** A readable long-form page: one h1, then an h2 per section. */
export function LegalPage({ doc, aside }: { doc: LegalDoc; aside?: ReactNode }) {
  return (
    <div className="px-5 py-16 tablet:px-10">
      <div className="mx-auto flex max-w-[820px] flex-col gap-12">
        <SectionTitle as="h1" title={doc.title} description={doc.intro} />
        {aside}
        <p className="border border-line px-4 py-3 text-base text-envy" role="note">
          Draft: these words describe what the site does today and are waiting for a lawyer&apos;s review before launch.
        </p>
        {doc.sections.map((s) => (
          <section key={s.heading} aria-labelledby={`h-${s.heading.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} className="flex flex-col gap-3">
            <h2 id={`h-${s.heading.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} className="font-display text-h3">
              {s.heading}
            </h2>
            {s.paragraphs?.map((p) => (
              <p key={p} className="text-copy">
                {p}
              </p>
            ))}
            {s.bullets ? (
              <ul className="flex flex-col gap-2">
                {s.bullets.map((b) => (
                  <li key={b} className="flex gap-3 text-copy">
                    <span aria-hidden className="text-gold">
                      ✦
                    </span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}
