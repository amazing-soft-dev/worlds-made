export interface ModerationResult {
  flagged: boolean;
  categories: string[];
}

/** A text classifier. The OpenAI Moderation endpoint in production, a keyword fake everywhere else. */
export interface Moderator {
  check(text: string): Promise<ModerationResult>;
}

export class OpenAiModerator implements Moderator {
  constructor(
    private readonly apiKey: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async check(text: string): Promise<ModerationResult> {
    const res = await this.fetchFn('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'omni-moderation-latest', input: text }),
    });
    if (!res.ok) throw new Error(`Moderation request failed: ${res.status}`);
    const body = (await res.json()) as { results?: Array<{ flagged: boolean; categories: Record<string, boolean> }> };
    const r = body.results?.[0];
    if (!r) throw new Error('Moderation response had no result');
    return { flagged: r.flagged, categories: Object.entries(r.categories).filter(([, v]) => v).map(([k]) => k) };
  }
}

/** Flags nothing except text containing the marker [[flag]], so tests can exercise the "flagged" path. */
export class FakeModerator implements Moderator {
  async check(text: string): Promise<ModerationResult> {
    return text.includes('[[flag]]') ? { flagged: true, categories: ['test'] } : { flagged: false, categories: [] };
  }
}
