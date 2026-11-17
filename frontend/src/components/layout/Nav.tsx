import Link from 'next/link';
import { AuthLink } from '@/components/auth/AuthLink';
import { MobileMenu } from '@/components/layout/MobileMenu';
import { site } from '@/content/site';

const linkClass =
  'text-eyebrow uppercase tracking-eyebrow text-ink transition-colors duration-200 ease-site hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold';

/** Mark: two rising strokes, drawn inline so it takes the gold token. */
function Mark() {
  return (
    <svg viewBox="0 0 28 25" width="28" height="25" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M1 2 L8 23 L14 8 L20 23 L27 2" />
    </svg>
  );
}

/**
 * Sticky top bar. From the tablet breakpoint the links sit inline (gap 48px, 80px on desktop);
 * below it they move into a native <details> menu so no JavaScript is needed.
 */
export function Nav() {
  return (
    <header className="sticky top-0 z-5 border-b border-gold-deep bg-bg">
      <div className="mx-auto flex h-16 items-center justify-between px-5 tablet:h-[68px] tablet:px-10 desktop:px-16">
        <Link href="/" aria-label={`${site.name} home`} className="text-gold">
          <Mark />
        </Link>

        <nav aria-label="Main" className="hidden tablet:block">
          <ul className="flex gap-12 desktop:gap-20">
            {site.nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClass}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-6">
          <AuthLink className={linkClass} />
          <MobileMenu items={site.nav} linkClass={linkClass} />
        </div>
      </div>
    </header>
  );
}
