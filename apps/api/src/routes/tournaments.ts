import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createTournamentSchema } from '@wkb/shared';
import { prisma } from '../db.js';
import { badRequest, forbidden, notFound, tooMany } from '../lib/httpError.js';
import { shuffle } from '../lib/random.js';
import { currentUser, requireAuth } from '../plugins/auth.js';
import { bracketView, lockTournament, startTournament } from '../services/tournament.js';
import { availableDeckSize } from '../game/draw.js';

const idParam = z.object({ id: z.coerce.number().int().positive() });

// How many tournaments one account can have open for registration at the same time
const OPEN_TOURNAMENTS_PER_USER = 3;

/* The next free seed. Seeds are not a count: after someone leaves, 'participants.length' is a seed that is already taken.
'startTournament' renumbers everyone anyway; this only keeps the registration list in a sensible order until then */
function nextSeed(participants: { seed: number }[]): number {
  return participants.reduce((highest, p) => Math.max(highest, p.seed), -1) + 1;
}

export async function tournamentRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/tournaments', { preHandler: requireAuth }, async () => {
    const rows = await prisma.tournament.findMany({
      orderBy: { createdAt: 'desc' },
      take: 25,
      include: { participants: true },
    });
    return {
      tournaments: rows.map((t) => ({
        id: t.id,
        name: t.name,
        status: t.status,
        size: t.size,
        difficulty: t.difficulty,
        cardCount: t.cardCount,
        registered: t.participants.length,
      })),
    };
  });
  app.post('/api/tournaments', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const me = currentUser(request);
    const input = createTournamentSchema.parse(request.body);
    const open = await prisma.tournament.count({ where: { createdById: me.id, status: 'registration' } });
    if (open >= OPEN_TOURNAMENTS_PER_USER)
      throw tooMany('error.tournament.tooMany');
    const available = await availableDeckSize({ categoryIds: [], difficulty: input.difficulty });
    if (available < 4)
      throw badRequest('error.room.notEnoughCards');
    const tournament = await prisma.tournament.create({
      data: {
        name: input.name,
        difficulty: input.difficulty,
        cardCount: input.cardCount,
        size: input.size,
        createdById: me.id,
        // The creator is seeded in immediately, a tournament with nobody in it is just a form that was submitted.
        participants: { create: { userId: me.id, seed: 0 } },
      },
    });
    return reply.code(201).send({ tournament: await bracketView(tournament.id) });
  });
  app.get('/api/tournaments/:id', { preHandler: requireAuth }, async (request) => {
    const { id } = idParam.parse(request.params);
    const view = await bracketView(id);
    if (!view) 
      throw notFound();
    return { tournament: view };
  });
  app.post('/api/tournaments/:id/join', { preHandler: requireAuth }, async (request) => {
    const me = currentUser(request);
    const { id } = idParam.parse(request.params);
    await prisma.$transaction(async (tx) => {
      await lockTournament(tx, id);
      const tournament = await tx.tournament.findUnique({
        where: { id },
        include: { participants: true },
      });
      if (!tournament) 
        throw notFound();
      if (tournament.status !== 'registration') 
        throw badRequest('error.tournament.alreadyStarted');
      if (tournament.participants.some((p) => p.userId === me.id))
        return;
      if (tournament.participants.length >= tournament.size)
        throw badRequest('error.tournament.full');
      await tx.tournamentParticipant.create({
        data: { tournamentId: id, userId: me.id, seed: nextSeed(tournament.participants) },
      });
    });
    return { tournament: await bracketView(id) };
  });
  // Under the same lock as join, fill and start, so a seat can't be given up while the bracket is being drawn from it
  app.delete('/api/tournaments/:id/leave', { preHandler: requireAuth }, async (request) => {
    const me = currentUser(request);
    const { id } = idParam.parse(request.params);
    await prisma.$transaction(async (tx) => {
      await lockTournament(tx, id);
      const tournament = await tx.tournament.findUnique({ where: { id } });
      if (!tournament)
        throw notFound();
      if (tournament.status !== 'registration')
        throw badRequest('error.tournament.alreadyStarted');
      await tx.tournamentParticipant.deleteMany({ where: { tournamentId: id, userId: me.id } });
    });
    return { tournament: await bracketView(id) };
  });

  // Fills the remaining seats with bots so a bracket can start on demand
  app.post('/api/tournaments/:id/fill', { preHandler: requireAuth }, async (request) => {
    const me = currentUser(request);
    const { id } = idParam.parse(request.params);
    await prisma.$transaction(async (tx) => {
      await lockTournament(tx, id);
      const tournament = await tx.tournament.findUnique({
        where: { id },
        include: { participants: true },
      });
      if (!tournament)
        throw notFound();
      if (tournament.createdById !== me.id)
        throw forbidden('error.tournament.hostOnly');
      if (tournament.status !== 'registration')
        throw badRequest('error.tournament.alreadyStarted');
      const seatsLeft = tournament.size - tournament.participants.length;
      if (seatsLeft <= 0)
        return;
      const taken = new Set(tournament.participants.map((p) => p.userId));
      const bots = await tx.user.findMany({ where: { isBot: true }, select: { id: true} });
      const available = shuffle(bots.map((b) => b.id).filter((botId) => !taken.has(botId)));
      if (available.length < seatsLeft)
        throw badRequest('error.tournament.notEnoughBots');
      let seed = nextSeed(tournament.participants);
      for (const botId of available.slice(0, seatsLeft))
      {
        await tx.tournamentParticipant.create({ data: { tournamentId: id, userId: botId, seed } });
        seed += 1;
      }
    });
    return { tournament: await bracketView(id) };
  });
  app.post('/api/tournaments/:id/start', { preHandler: requireAuth }, async (request) => {
    const me = currentUser(request);
    const { id } = idParam.parse(request.params);
    const error = await startTournament(id, me.id);
    if (error === 'error.tournament.hostOnly')
      throw forbidden(error);
    if (error) 
      throw badRequest(error);
    return { tournament: await bracketView(id) };
  });
}
