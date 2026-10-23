import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DIFFICULTY_PRESETS, createRoomSchema, roomCodeSchema } from '@wkb/shared';
import { prisma } from '../db.js';
import { badRequest, notFound, tooMany } from '../lib/httpError.js';
import { roomCode } from '../lib/random.js';
import { currentUser, requireAuth } from '../plugins/auth.js';
import { buildRoomSummary, listPublicRooms, roomInclude } from '../services/rooms.js';
import { availableDeckSize } from '../game/draw.js';
import { announceRoom } from '../game/registry.js';

/* A room costs the client one request and the database a row that outlives it, so each account gets a budget.
Far above what playing needs (one room per match at most), far below what a script would make */
const ROOMS_PER_HOUR = 20;

// Rooms are created over HTTP; activity inside a room uses the WebSocket
export async function roomRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/rooms', { preHandler: requireAuth }, async () => ({
    rooms: await listPublicRooms(),
  }));
  app.get('/api/rooms/:code', { preHandler: requireAuth }, async (request) => {
    const parsed = z.object({ code: roomCodeSchema }).safeParse(request.params);
    if (!parsed.success) 
      throw notFound('error.room.notFound');
    const room = await prisma.room.findUnique({
      where: { code: parsed.data.code },
      include: roomInclude,
    });
    if (!room) 
      throw notFound('error.room.notFound');
    return { room: await buildRoomSummary(room) };
  });
  app.post('/api/rooms', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const me = currentUser(request);
    const input = createRoomSchema.parse(request.body);
    const recent = await prisma.room.count({
      where: { hostUserId: me.id, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
    });
    if (recent >= ROOMS_PER_HOUR)
      throw tooMany('error.room.tooMany');
    // A category room is a separate room, not a filter. Its category comes from the one selected id
    const primaryCategoryId = input.mode === 'category' ? (input.settings.categoryIds[0] ?? null) : null;
    if (primaryCategoryId !== null) 
    {
      const category = await prisma.category.findUnique({ where: { id: primaryCategoryId } });
      if (!category) 
        throw badRequest('error.room.unknownCategory');
    }
    // Refuse to create a room the card set cannot actually fill.
    const available = await availableDeckSize({
      categoryIds: input.settings.categoryIds,
      difficulty: input.difficulty,
    });
    if (available < 4) 
      throw badRequest('error.room.notEnoughCards');
    const cardCount = Math.min(input.settings.cardCount, available);
    // Try a few times in the astronomically unlikely event of a code clash.
    for (let attempt = 0; attempt < 5; attempt += 1) 
    {
      try {
        const room = await prisma.room.create({
          data: {
            code: roomCode(),
            name: input.name,
            visibility: input.visibility,
            mode: input.mode,
            categoryId: primaryCategoryId,
            difficulty: input.difficulty,
            hostUserId: me.id,
            maxPlayers: input.maxPlayers,
            settings: {
              create: {
                cardCount,
                categoryIds: input.settings.categoryIds,
                answerWindowMs: input.settings.answerWindowMs,
                comboEnabled: input.settings.comboEnabled,
                doubleCardEnabled: input.settings.doubleCardEnabled,
              },
            },
          },
          include: roomInclude,
        });
        const summary = await buildRoomSummary(room);
        announceRoom(summary);
        return reply.code(201).send({ room: summary });
      } catch (error) {
        const isCodeClash =
          typeof error === 'object' &&
          error !== null &&
          (error as { code?: string }).code === 'P2002';
        if (!isCodeClash || attempt === 4) 
          throw error;
      }
    }
    throw badRequest('error.room.creationFailed');
  });
  //Starting values for the create room form
  app.get('/api/rooms/defaults', { preHandler: requireAuth }, async () => ({
    difficulties: DIFFICULTY_PRESETS,
  }));
}
