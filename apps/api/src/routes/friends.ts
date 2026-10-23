import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { friendRequestSchema } from '@wkb/shared';
import { prisma } from '../db.js';
import { badRequest, notFound } from '../lib/httpError.js';
import { publicProfile, publicProfileSelect } from '../lib/serialize.js';
import { currentUser, requireAuth } from '../plugins/auth.js';
import { isOnline, onlineUserIds } from '../game/registry.js';

/* A friendship is one row: 'user_id' is who sent the request and 'friend_id' is who received it.
One row per pair keeps it clear who asked who, and accepting it is just an update.*/

const idParam = z.object({ id: z.coerce.number().int().positive() });

export async function friendRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/friends', { preHandler: requireAuth }, async (request) => {
    const me = currentUser(request);
    const rows = await prisma.friendship.findMany({
      where: { OR: [{ userId: me.id }, { friendId: me.id }] },
      include: {
        user: { select: publicProfileSelect },
        friend: { select: publicProfileSelect },
      },
      orderBy: { createdAt: 'desc' },
    });
    const live = onlineUserIds();
    const decorate = (other: (typeof rows)[number]['user']) => ({
      ...publicProfile(other),
      online: isOnline(other.id, other.lastSeenAt, live),
    });
    const accepted = [];
    const incoming = [];
    const outgoing = [];
    const blocked = [];
    const blockedByMe = new Set(rows.filter((row) => row.userId === me.id && row.status === 'blocked').map((row) => row.friendId));
    for (const row of rows)
    {
      const iAmRequester = row.userId === me.id;
      const other = iAmRequester ? row.friend : row.user;
      if (row.status === 'accepted')
        accepted.push(decorate(other));
      else if (row.status === 'blocked')
      {
        // Only the person who blocked sees the entry
        if (iAmRequester)
          blocked.push(decorate(other));
      }
      else if (iAmRequester)
        outgoing.push(decorate(other));
      // A request from someone I blocked stays invisible to me
      else if (!blockedByMe.has(row.userId))
        incoming.push(decorate(other));
    }
    return { accepted, incoming, outgoing, blocked };
  });
  app.post('/api/friends', { preHandler: requireAuth }, async (request) => {
    const me = currentUser(request);
    const { userId } = friendRequestSchema.parse(request.body);
    if (userId === me.id)
      throw badRequest('error.friends.self');
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { isBot: true } });
    if (!target || target.isBot)
      throw notFound();
    /* Two people requesting each other at the same moment would each find no row and each create one, two pending requests instead of
    a friendship. A transaction scoped lock on the pair (smaller id first, so both sides take the same one) makes the second wait for the first */
    const status = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(${Math.min(me.id, userId)}::int4, ${Math.max(me.id, userId)}::int4)`;
      const rows = await tx.friendship.findMany({
        where: {
          OR: [
            { userId: me.id, friendId: userId },
            { userId, friendId: me.id },
          ],
        },
      });
      const mine = rows.find((row) => row.userId === me.id);
      const theirs = rows.find((row) => row.userId === userId);
      if (mine?.status === 'blocked')
        throw badRequest('error.friends.blocked');
      if (mine?.status === 'accepted' || theirs?.status === 'accepted')
        return 'accepted';
      // Requesting someone who already requested us accepts their request
      if (theirs?.status === 'pending')
      {
        await tx.friendship.update({
          where: { userId_friendId: { userId, friendId: me.id } },
          data: { status: 'accepted' },
        });
        return 'accepted';
      }
      /* If they blocked us, the request is still stored and looks pending from this side, like any other, while their list never shows it
      (see the GET above). Answering "blocked" would tell the requester something the other person chose not to tell them */
      if (!mine)
        await tx.friendship.create({ data: { userId: me.id, friendId: userId, status: 'pending' } });
      return 'pending';
    });
    return { status };
  });
  app.post('/api/friends/:id/accept', { preHandler: requireAuth }, async (request) => {
    const me = currentUser(request);
    const { id } = idParam.parse(request.params);
    const [pending, mine] = await Promise.all([
      prisma.friendship.findUnique({ where: { userId_friendId: { userId: id, friendId: me.id } } }),
      prisma.friendship.findUnique({ where: { userId_friendId: { userId: me.id, friendId: id } } }),
    ]);
    // A request from someone I blocked is not shown to me, so it can't be accepted either
    if (!pending || pending.status !== 'pending' || mine?.status === 'blocked')
      throw notFound();
    await prisma.friendship.update({
      where: { userId_friendId: { userId: id, friendId: me.id } },
      data: { status: 'accepted' },
    });
    return { status: 'accepted' };
  });
  app.delete('/api/friends/:id', { preHandler: requireAuth }, async (request) => {
    const me = currentUser(request);
    const { id } = idParam.parse(request.params);
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { userId: me.id, friendId: id },
          { userId: id, friendId: me.id, status: { not: 'blocked' } },
        ],
      },
    });
    return { ok: true };
  });
  app.post('/api/friends/:id/block', { preHandler: requireAuth }, async (request) => {
    const me = currentUser(request);
    const { id } = idParam.parse(request.params);
    if (id === me.id) 
      throw badRequest('error.friends.self');
    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!target)
      throw notFound();
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { userId: me.id, friendId: id },
          { userId: id, friendId: me.id, status: { not: 'blocked' } },
        ],
      },
    });
    await prisma.friendship.create({ data: { userId: me.id, friendId: id, status: 'blocked' } });
    return { status: 'blocked' };
  });
}
