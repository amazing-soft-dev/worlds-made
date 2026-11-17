import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { cinzel, garamond } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'Worlds Made',
  description: 'Describe a game, play it, share it.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${garamond.variable}`}>
      <body className="font-body">{children}</body>
    </html>
  );
}
