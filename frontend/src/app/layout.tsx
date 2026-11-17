import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Footer } from '@/components/layout/Footer';
import { Nav } from '@/components/layout/Nav';
import { SkipLink } from '@/components/layout/SkipLink';
import { site } from '@/content/site';
import { cinzel, garamond } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: site.name,
  description: site.description,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${garamond.variable}`}>
      <body className="font-body">
        <SkipLink />
        <Nav />
        <main id="main" tabIndex={-1} className="outline-none">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
