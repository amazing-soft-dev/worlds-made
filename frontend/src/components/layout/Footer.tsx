import Link from 'next/link';
import { site } from '@/content/site';

export function Footer() {
  return (
    <footer className="mt-20 border-t border-gold-deep">
      <div className="mx-auto flex min-h-[104px] flex-col items-start justify-between gap-4 px-5 py-6 tablet:flex-row tablet:items-center tablet:px-10">
        <p className="text-copy">© 2026 {site.name}. Games are made by people and an AI, and run in a sealed frame.</p>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-7 gap-y-2">
            {site.footerLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-copy transition-colors duration-200 ease-site hover:text-gold">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
