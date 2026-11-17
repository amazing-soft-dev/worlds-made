import type { FastifyPluginAsync } from 'fastify';
import { licenseSchema } from '@worlds-made/shared';
import { z } from 'zod';
import { requireProfile } from '../auth/profile';
import type { Services } from '../container';
import type { GameRow, GameVersionRow } from '../db/tables';
import { AppError } from '../errors';

export const fullGame = (g: GameRow) => ({
  id: g.id,
  title: g.title,
  description: g.description,
  tags: g.tags,
  status: g.status,
  visibility: g.visibility,
  allowDownload: g.allow_download,
  license: g.license,
  likeCount: g.like_count,
  currentVersionId: g.current_version_id,
  createdAt: g.created_at,
});

const versionSummary = (v: GameVersionRow) => ({ id: v.id, prompt: v.prompt, sizeBytes: v.size_bytes, model: v.model, createdAt: v.created_at });
const idParam = z.object({ id: z.string().uuid() });

/** The signed-in player's own games: list, read with history, edit details, restore a version, delete. */
export const libraryRoutes = (services: Services): FastifyPluginAsync => async (app) => {
  const { games, moderation } = services;

  app.get('/games', async (req) => {
    const { profile } = await requireProfile(req, services.profiles, { verified: false });
    return { games: (await games.listOwned(profile.id)).map(fullGame) };
  });

  app.get('/games/:id', async (req) => {
    const { profile } = await requireProfile(req, services.profiles, { verified: false });
    const game = await games.getOwned(idParam.parse(req.params).id, profile.id);
    return { game: fullGame(game), versions: (await games.versions(game.id)).map(versionSummary) };
  });

  app.patch('/games/:id', async (req) => {
    const { profile } = await requireProfile(req, services.profiles, { verified: false });
    const game = await games.getOwned(idParam.parse(req.params).id, profile.id);
    const body = z
      .object({
        title: z.string().trim().min(1).max(60).optional(),
        description: z.string().trim().max(300).optional(),
        tags: z.array(z.string().trim().min(1).max(20)).max(6).optional(),
        allowDownload: z.boolean().optional(),
        license: licenseSchema.optional(),
      })
      .parse(req.body);
    // Titles, descriptions and tags are public text, so they pass moderation on every change.
    const text = [body.title, body.description, ...(body.tags ?? [])].filter(Boolean).join('\n');
    const verdict = await moderation.checkText(text);
    if (!verdict.allowed) throw new AppError(422, 'text_blocked', verdict.message);
    const updated = await games.updateMeta(game.id, {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.tags !== undefined && { tags: body.tags }),
      ...(body.allowDownload !== undefined && { allow_download: body.allowDownload }),
      ...(body.license !== undefined && { license: body.license }),
    });
    return { game: fullGame(updated) };
  });

  app.post('/games/:id/restore', async (req) => {
    const { profile } = await requireProfile(req, services.profiles, { verified: false });
    const game = await games.getOwned(idParam.parse(req.params).id, profile.id);
    const { versionId } = z.object({ versionId: z.string().uuid() }).parse(req.body);
    return { game: fullGame(await games.restore(game.id, versionId)) };
  });

  app.delete('/games/:id', async (req, reply) => {
    const { profile } = await requireProfile(req, services.profiles, { verified: false });
    await games.remove(await games.getOwned(idParam.parse(req.params).id, profile.id));
    return reply.code(204).send();
  });
};
