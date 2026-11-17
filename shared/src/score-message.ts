import { z } from 'zod';

/**
 * The only messages a sandboxed game may send to the parent page via
 * parent.postMessage. Anything else is ignored (spec: "Narrow messaging").
 */
export const scoreMessageSchema = z.object({
  type: z.literal('score'),
  value: z.number().finite(),
});

export const errorMessageSchema = z.object({
  type: z.literal('error'),
  message: z.string().max(500).optional(),
});

export const gameMessageSchema = z.discriminatedUnion('type', [scoreMessageSchema, errorMessageSchema]);

export type ScoreMessage = z.infer<typeof scoreMessageSchema>;
export type ErrorMessage = z.infer<typeof errorMessageSchema>;
export type GameMessage = z.infer<typeof gameMessageSchema>;

/** Returns the parsed message or null; never throws on hostile input. */
export function parseGameMessage(data: unknown): GameMessage | null {
  const r = gameMessageSchema.safeParse(data);
  return r.success ? r.data : null;
}
