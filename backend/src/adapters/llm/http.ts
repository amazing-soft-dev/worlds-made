import { LlmProviderError, LlmTimeoutError, type LlmProvider, type LlmRequest, type LlmResponse } from './provider';

interface ChatCompletion {
  model?: string;
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/**
 * Works with any provider that exposes an OpenAI-style /chat/completions endpoint (the provider is still open).
 * A provider with a different wire format needs its own small LlmProvider implementation, nothing else changes.
 */
export class HttpLlmProvider implements LlmProvider {
  readonly name = 'http';
  constructor(
    private readonly cfg: { url: string; key: string; model: string },
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async complete(req: LlmRequest): Promise<LlmResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), req.timeoutMs);
    try {
      const res = await this.fetchFn(this.cfg.url, {
        method: 'POST',
        signal: controller.signal,
        headers: { authorization: `Bearer ${this.cfg.key}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.cfg.model,
          max_tokens: req.maxOutputTokens,
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.user },
          ],
        }),
      });
      if (!res.ok) throw new LlmProviderError(`Model API returned ${res.status}`, res.status);
      const body = (await res.json()) as ChatCompletion;
      const text = body.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || !text) throw new LlmProviderError('Model API returned no text');
      return {
        text,
        model: body.model ?? this.cfg.model,
        tokensIn: body.usage?.prompt_tokens ?? 0,
        tokensOut: body.usage?.completion_tokens ?? 0,
      };
    } catch (err) {
      if (err instanceof LlmProviderError) throw err;
      if ((err as { name?: string }).name === 'AbortError') throw new LlmTimeoutError(req.timeoutMs);
      throw new LlmProviderError(err instanceof Error ? err.message : 'Model request failed');
    } finally {
      clearTimeout(timer);
    }
  }
}
