import { SectionTitle } from '@/components/ui/SectionTitle';
import { site } from '@/content/site';

/** Native <details> accordion: keyboard accessible, no JavaScript. */
export function Faq() {
  return (
    <section id="faq" className="px-5 py-20 tablet:px-10">
      <div className="mx-auto max-w-[820px]">
        <SectionTitle eyebrow="Questions" title="Good to know" />
        <div className="mt-12 border-t border-line">
          {site.faq.map((item) => (
            <details key={item.q} className="group border-b border-line py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-display text-base tracking-button transition-colors duration-200 ease-site hover:text-gold">
                {item.q}
                <span aria-hidden className="text-gold transition-transform duration-200 group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-4 text-copy text-envy">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
