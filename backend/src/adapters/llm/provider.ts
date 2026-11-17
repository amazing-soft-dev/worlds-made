export type LlmPurpose = 'generate' | 'repair' | 'change' | 'parse' | 'explain' | 'daily';

export interface LlmRequest {
  purpose: LlmPurpose;
  system: string;
  user: string;
  /** Hard cap on output tokens for this call. */
  maxOutputTokens: number;
  /** The call is abandoned after this long (spec: 90 seconds for builds). */
  timeoutMs: number;
}

export interface LlmResponse {
  text: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
}

/** A hosted model. The provider is open: anything with a chat-completions style endpoint, or a fake. */
export interface LlmProvider {
  readonly name: string;
  complete(req: LlmRequest): Promise<LlmResponse>;
}

export class LlmTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`The model did not answer within ${timeoutMs} ms`);
    this.name = 'LlmTimeoutError';
  }
}

export class LlmProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'LlmProviderError';
  }
}
