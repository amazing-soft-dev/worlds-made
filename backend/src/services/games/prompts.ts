import { templateFor, type Genre } from './templates';

/** The fixed system prompt for the game generator (abridged from the V1 spec). */
export const GAME_SYSTEM_PROMPT = `You write one complete HTML5 game as a single HTML file.
Rules:
- Inline all CSS and JavaScript. Use <canvas> 2D. No external URLs, fonts, images, CDNs, fetch, XHR, WebSocket, or storage APIs.
- Draw all art with code or inline SVG/data URIs. Keep the file under 200 KB.
- Include: a title screen, instructions, keyboard AND touch controls, score, game over, restart.
- When the game ends, call: parent.postMessage({type:"score", value:<number>}, "*")
- Content must suit ages 8+. No gore, sexual content, real weapons branding, hate, or real people.
- Do not copy named characters, logos, or trademarked games. Make original look-alikes.
- Start from the TEMPLATE below and keep its loop structure.
- Never use eval, Function, window.open, document.cookie, localStorage, navigation, iframes, forms, or computed global access.
- Reply with the finished HTML file only, in one \`\`\`html code block.`;

export type BuildKind = 'generate' | 'repair' | 'change' | 'daily';

export interface PromptInput {
  kind: BuildKind;
  genre: Genre;
  /** The player's request (already moderated, with franchise names swapped). */
  request: string;
  /** For repair and change: the current game. */
  currentHtml?: string;
  /** For repair: errors captured from the sandboxed frame. */
  errors?: string[];
  /** A smaller template for the retry after a timeout. */
  compact?: boolean;
}

export function buildUserPrompt(p: PromptInput): string {
  const parts: string[] = [];
  if (p.kind === 'repair') {
    parts.push('Fix this game so it runs without errors. Keep what already works.');
    parts.push(`Errors captured from the frame:\n${(p.errors ?? []).slice(0, 10).map((e) => `- ${e.slice(0, 300)}`).join('\n') || '- (none reported)'}`);
    parts.push(`Current game:\n\`\`\`html\n${p.currentHtml ?? ''}\n\`\`\``);
    return parts.join('\n\n');
  }
  if (p.kind === 'change') {
    parts.push(`Change this game as asked: ${p.request}`);
    parts.push(`Current game:\n\`\`\`html\n${p.currentHtml ?? ''}\n\`\`\``);
    return parts.join('\n\n');
  }
  parts.push(p.kind === 'daily' ? `Make today's daily challenge. Theme: ${p.request}. It must be quick to learn and score points.` : `Make this game: ${p.request}`);
  parts.push(`Genre: ${p.genre}.${p.compact ? ' Keep it small and simple.' : ''}`);
  parts.push(`TEMPLATE:\n\`\`\`html\n${templateFor(p.genre)}\n\`\`\``);
  return parts.join('\n\n');
}

/** Pulls the HTML out of a model reply: a fenced block if present, otherwise from <!doctype or <html to </html>. */
export function extractHtml(reply: string): string | null {
  const fenced = reply.match(/```(?:html)?\s*\n([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? reply).trim();
  const start = candidate.search(/<!doctype html|<html/i);
  if (start === -1) return null;
  const endTag = candidate.toLowerCase().lastIndexOf('</html>');
  return endTag === -1 ? candidate.slice(start) : candidate.slice(start, endTag + 7);
}
