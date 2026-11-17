import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Footer } from '@/components/layout/Footer';
import { Monitoring } from '@/components/Monitoring';
import { Nav } from '@/components/layout/Nav';
import { SkipLink } from '@/components/layout/SkipLink';
import { site } from '@/content/site';
import { AuthProvider } from '@/lib/auth';
import { cinzel, garamond } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name}: ${site.tagline}`, template: `%s · ${site.name}` },
  description: site.description,
  openGraph: { siteName: site.name, type: 'website', locale: 'en_US' },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${garamond.variable}`}>
      <body className="font-body">
        <AuthProvider>
          <SkipLink />
          <Nav />
          <main id="main" tabIndex={-1} className="outline-none">
            {children}
          </main>
          <Footer />
        </AuthProvider>
        <Monitoring />
      </body>
    </html>
  );
}
