import { site } from '@/content/site';

export const dynamic = 'force-static';

/** A plain-text summary for AI assistants (llms.txt convention). */
export function GET() {
  const lines = [
    `# ${site.name}`,
    '',
    `> ${site.description}`,
    '',
    '## What it is',
    '- An AI game maker: describe a game, play it in a sandboxed frame, publish it to a gallery, or download it as one .html file.',
    '- A daily challenge: one short game per day, the same for everyone, with streaks and a top-100 leaderboard.',
    '- Game recommendations backed by the RAWG catalogue, with every pick linking to a real game record.',
    '',
    '## Pages',
    ...site.nav.map((n) => `- [${n.label}](${new URL(n.href, site.url)})`),
    '',
    '## Safety',
    '- Generated games run in a sandboxed iframe on a separate domain with no network access.',
    '- No personal data is collected from visitors under 13. Ads use child treatment when age is under 13 or unknown.',
    '- See /parents for how kids, ads and data are handled.',
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
