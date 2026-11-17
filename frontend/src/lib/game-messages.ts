import { parseGameMessage, type GameMessage } from '@worlds-made/shared';

/**
 * The page's side of the "narrow messaging" rule. A message is accepted only if it came from our own game frame
 * (`event.source` is that frame's window) AND from the opaque origin a sandboxed frame without allow-same-origin has
 * ("null"), AND it is exactly a score or an error message. Everything else is ignored.
 */
export function acceptGameMessage(event: { source: unknown; origin: string; data: unknown }, frameWindow: unknown): GameMessage | null {
  if (!frameWindow || event.source !== frameWindow) return null;
  if (event.origin !== 'null') return null;
  return parseGameMessage(event.data);
}
