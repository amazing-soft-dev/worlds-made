import { LICENSE_LABELS, licenseSchema } from '@worlds-made/shared';
import type { GameRow } from '../../db/tables';
import { AppError } from '../../errors';
import { createZip } from '../../lib/zip';
import { scanGameHtml } from '../scanner';

export interface DownloadInput {
  game: GameRow;
  html: string;
  creator: string;
  siteUrl: string;
}

const plain = (s: string) => s.replace(/[^\w .,'!?&:/-]/g, '').replace(/--+/g, '-').trim();

/** Host only (no scheme): a full URL in the file would trip the scanner's external-URL rule when the file is scanned again. */
const siteHost = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return plain(url);
  }
};

export function fileSlug(title: string): string {
  return plain(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'game';
}

function licenseLabel(license: string): string {
  const parsed = licenseSchema.safeParse(license);
  return parsed.success ? LICENSE_LABELS[parsed.data] : 'All rights reserved';
}

/** The comment every downloaded file starts with: where it came from, who made it, under what licence, and a warning. */
export function headerComment(i: DownloadInput): string {
  return [
    '<!--',
    `  ${plain(i.game.title) || 'Untitled game'}`,
    `  Made on Worlds Made (${siteHost(i.siteUrl)}) by ${plain(i.creator) || 'a player'}.`,
    `  Licence: ${licenseLabel(i.game.license)}.`,
    '  This file was written by an AI from a player\'s prompt. Open it only in a web browser, never any other way.',
    '-->',
  ].join('\n');
}

/** Adds the header after the doctype so the page still renders in standards mode. */
export function withHeader(html: string, i: DownloadInput): string {
  const header = headerComment(i);
  const doctype = /^\s*<!doctype html[^>]*>/i.exec(html);
  return doctype ? `${doctype[0]}\n${header}${html.slice(doctype[0].length)}` : `${header}\n${html}`;
}

export function readme(i: DownloadInput): string {
  return [
    `${plain(i.game.title) || 'Untitled game'}`,
    `Made on Worlds Made (${siteHost(i.siteUrl)}) by ${plain(i.creator) || 'a player'}`,
    '',
    `LICENSE: ${licenseLabel(i.game.license)}`,
    '',
    'PLAY OFFLINE',
    '  Open index.html in a web browser. Only open it in a browser.',
    '',
    'UPLOAD TO ITCH.IO',
    '  1. On itch.io choose Upload new project.',
    '  2. Set "Kind of project" to HTML.',
    '  3. Upload this .zip file and tick "This file will be played in the browser".',
    '  4. Set the viewport size to 360 x 540 and enable the mobile-friendly and fullscreen options.',
    '  5. Copy the licence above into the project description.',
    '',
    'This game was written by an AI from a player\'s prompt. It contains no network code.',
    '',
  ].join('\n');
}

/** Scans one more time, then builds either the single HTML file or the zip. Throws 410 if the file no longer passes. */
export function prepareDownload(format: 'html' | 'zip', i: DownloadInput): { body: Buffer; contentType: string; filename: string } {
  if (!scanGameHtml(i.html).ok) throw new AppError(410, 'game_unavailable', 'This game cannot be downloaded');
  const html = withHeader(i.html, i);
  const slug = fileSlug(i.game.title);
  if (format === 'html') return { body: Buffer.from(html, 'utf8'), contentType: 'text/html; charset=utf-8', filename: `${slug}.html` };
  return {
    body: createZip([
      { name: 'index.html', data: html },
      { name: 'README.txt', data: readme(i) },
    ]),
    contentType: 'application/zip',
    filename: `${slug}.zip`,
  };
}
