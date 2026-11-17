import { pickGenre, renderTemplate } from '../../services/games/templates';
import type { LlmProvider, LlmRequest, LlmResponse } from './provider';

const approx = (s: string) => Math.ceil(s.length / 4);

/**
 * Deterministic stand-in for a real model, used by tests, CI and keyless local development. For build requests it
 * returns the matching starter template with a title taken from the request; parse and explain return small JSON.
 */
export class FakeLlm implements LlmProvider {
  readonly name = 'fake';
  readonly calls: LlmRequest[] = [];

  async complete(req: LlmRequest): Promise<LlmResponse> {
    this.calls.push(req);
    let text: string;
    if (req.purpose === 'parse') {
      const u = req.user.toLowerCase();
      const genres = ['platformer', 'puzzle', 'shooter', 'racing', 'action', 'adventure', 'strategy'].filter((g) => u.includes(g));
      text = JSON.stringify({ genres, platforms: [], priceMax: u.includes('free') ? 0 : null, ratingCeiling: 'E10+', keywords: u.split(/\W+/).filter((w) => w.length > 4).slice(0, 3) });
    } else if (req.purpose === 'explain') {
      text = req.user
        .split('\n')
        .filter((l) => l.startsWith('GAME: '))
        .map((l) => `${l.slice(6)}: a good match for what you asked.`)
        .join('\n');
    } else {
      const wanted = /(?:Make this game|Change this game as asked|Theme): ([^\n]+)/.exec(req.user)?.[1] ?? 'My Game';
      const genre = pickGenre(wanted);
      const title = wanted.split(/\s+/).slice(0, 4).join(' ');
      // Repairs and changes return the current genre template; a fake cannot really edit code.
      text = '```html\n' + renderTemplate(genre, title, 190 + (wanted.length % 120)) + '\n```';
    }
    return { text, model: 'fake-model', tokensIn: approx(req.system + req.user), tokensOut: approx(text) };
  }
}
