import { AppError } from '../../errors';
import { findBlocked } from './blocklist';
import { rewriteFranchises, type Swap } from './franchise';
import type { ModerationResult, Moderator } from './moderator';

export type PromptVerdict =
  | { allowed: true; text: string; swaps: Swap[] }
  | { allowed: false; reason: 'blocklist' | 'flagged'; message: string };

export type TextVerdict = { allowed: true } | { allowed: false; reason: 'blocklist' | 'flagged'; message: string };

const FRIENDLY = "Let's keep it friendly and original. Try describing the game without that, for example by its genre and mood.";

const UNAVAILABLE = "We can't check ideas right now, so nothing was used. Please try again in a few minutes.";

export class ModerationService {
  constructor(
    private readonly moderator: Moderator,
    private readonly extraTerms: readonly string[] = [],
  ) {}

  /** The classifier is a network service. If it fails, fail closed: nothing is let through unchecked, and the player gets a clear retry message. */
  private async classify(text: string): Promise<ModerationResult> {
    try {
      return await this.moderator.check(text);
    } catch {
      throw new AppError(503, "moderation_unavailable", UNAVAILABLE);
    }
  }

  /** Before the AI call: blocklist, then franchise stand-ins (told to the user), then the classifier. A block costs no build. */
  async checkPrompt(prompt: string): Promise<PromptVerdict> {
    if (findBlocked(prompt, this.extraTerms)) return { allowed: false, reason: 'blocklist', message: FRIENDLY };
    const { text, swaps } = rewriteFranchises(prompt);
    const result = await this.classify(text);
    if (result.flagged) return { allowed: false, reason: 'flagged', message: FRIENDLY };
    return { allowed: true, text, swaps };
  }

  /** Visible text of a generated game, a gallery title, description or tags. */
  async checkText(text: string): Promise<TextVerdict> {
    if (!text.trim()) return { allowed: true };
    if (findBlocked(text, this.extraTerms)) return { allowed: false, reason: 'blocklist', message: 'This text is not allowed on the site.' };
    const result = await this.classify(text);
    return result.flagged ? { allowed: false, reason: 'flagged', message: 'This text is not allowed on the site.' } : { allowed: true };
  }

  /** Display names are checked against the blocklist only; under-18s never choose one. */
  checkDisplayName(name: string): TextVerdict {
    return findBlocked(name, this.extraTerms)
      ? { allowed: false, reason: 'blocklist', message: 'That name is not available.' }
      : { allowed: true };
  }
}
