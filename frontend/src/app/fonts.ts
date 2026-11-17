import { Cinzel, EB_Garamond } from 'next/font/google';

/** Display face: headings, buttons, labels. */
export const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-cinzel',
  display: 'swap',
});

/** Body face: paragraphs, navigation, eyebrow text. Italic is used for the accent word in the hero. */
export const garamond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  style: ['normal', 'italic'],
  variable: '--font-garamond',
  display: 'swap',
});
