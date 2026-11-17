'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Item = { label: string; href: string };

/**
 * The phone menu: a native <details> (keyboard and screen reader friendly, no extra ARIA). Keyed by the path, so
 * it closes by itself after you pick a page instead of staying open over the next one.
 */
export function MobileMenu({ items, linkClass }: { items: readonly Item[]; linkClass: string }) {
  const pathname = usePathname();
  return (
    <details key={pathname} className="relative tablet:hidden">
      <summary className={`${linkClass} cursor-pointer list-none`} aria-label="Menu">
        Menu
      </summary>
      <ul className="absolute right-0 top-full mt-4 flex min-w-44 flex-col gap-4 border border-gold-deep bg-bg p-5">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className={linkClass}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
