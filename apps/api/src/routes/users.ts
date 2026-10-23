import { randomUUID } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  AVATAR_MAX_BYTES,
  deleteAccountSchema,
  presetToStored,
  updateProfileSchema,
} from '@wkb/shared';
import { prisma } from '../db.js';
import { badRequest, forbidden, notFound, tooLarge, unauthorized } from '../lib/httpError.js';
import { EXTENSION, sniffImage, stripMetadata } from '../lib/images.js';
import { displayNameConflict, displayNameTaken, isDisplayNameClash } from '../lib/displayNames.js';
import { log } from '../lib/logger.js';
import { publicProfile, publicProfileSelect, sessionUser } from '../lib/serialize.js';
import { currentUser, requireAuth } from '../plugins/auth.js';
import { verifyPassword } from '../lib/password.js';
import { isDemoAccount } from '../seed/data.js';
import { clearRefreshCookie } from './auth.js';
import { activeSessions, isOnline, onlineUserIds } from '../game/registry.js';
import { computeUserStats, matchHistory } from '../services/stats.js';
import { forfeitTournaments } from '../services/tournament.js';

export const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

// A file that is already gone is fine; any other failure leaves an orphan on disk, which is worth a line in the log but not a failed request
async function removeUpload(file: string): Promise<void> {
  await unlink(file).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT')
      log.warn({ err: error, file: path.basename(file) }, 'could not delete uploaded file');
  });
}

// Deletes the file behind an avatar URL when it's one of ours; stock avatars and provider pictures are not files
async function removeUploadedAvatar(avatarUrl: string | null | undefined): Promise<void> {
  if (avatarUrl?.startsWith('/api/uploads/'))
    await removeUpload(path.join(UPLOAD_DIR, path.basename(avatarUrl)));
}

const idParam = z.object({ id: z.coerce.number().int().positive() });

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.patch('/api/users/me', { preHandler: requireAuth }, async (request) => {
    const me = currentUser(request);
    const input = updateProfileSchema.parse(request.body);
    if (input.displayName) 
    {
      const account = await prisma.user.findUnique({
        where: { id: me.id },
        select: { email: true, displayName: true },
      });
      if (account && isDemoAccount(account.email) && input.displayName !== account.displayName)
        throw forbidden();
      // Ignoring case, and not counting this account, so changing only the case of your own name is allowed
      if (await displayNameTaken(input.displayName, me.id))
        throw displayNameConflict();
    }
    /*Set only once, ie, a repeat visit to /setup must not overwrite the start date, so we check the row ('currentUser' has only id and name)
    and write only if it's still null */
    let onboardedAt: Date | undefined;
    if (input.onboarded) 
    {
      const current = await prisma.user.findUnique({
        where: { id: me.id },
        select: { onboardedAt: true },
      });
      if (current && current.onboardedAt === null) 
        onboardedAt = new Date();
    }
    // Choosing a stock avatar replaces whatever was there, including an uploaded file, which is then orphaned on disk unless it is removed here.
    let avatarUrl: string | null | undefined;
    let replacedAvatar: string | null = null;
    if (input.avatarPreset !== undefined)
    {
      const previous = await prisma.user.findUnique({
        where: { id: me.id },
        select: { avatarUrl: true },
      });
      replacedAvatar = previous?.avatarUrl ?? null;
      avatarUrl = input.avatarPreset === null ? null : presetToStored(input.avatarPreset);
    }
    let user;
    try {
      user = await prisma.user.update({
        where: { id: me.id },
        data: {
          ...(input.displayName ? { displayName: input.displayName } : {}),
          ...(input.locale ? { locale: input.locale } : {}),
          ...(avatarUrl !== undefined ? { avatarUrl } : {}),
          ...(onboardedAt ? { onboardedAt } : {}),
        },
      });
    } catch (error) {
      // Someone took the name between the check above and this write, or it differs from theirs only in an accent's case
      if (isDisplayNameClash(error))
        throw displayNameConflict();
      throw error;
    }
    // Deleted only once the profile no longer points at it; done first, a failed update would leave the profile showing a missing file
    if (avatarUrl !== undefined)
      await removeUploadedAvatar(replacedAvatar);
    return { user: sessionUser(user), locale: user.locale, displayName: user.displayName };
  });

/*  Everything stored about this account, as one JSON document. Built from the tables, not the UI read models. 'password_hash' is left out on purpose,
because it's useless to the owner and something to crack offline for anyone who hijacked the session */
  app.get('/api/users/me/export', { preHandler: requireAuth }, async (request, reply) => {
    const me = currentUser(request);
    const [user, oauth, friendships, achievements, seenFacts, players, tournaments] =
      await Promise.all([
        prisma.user.findUnique({ where: { id: me.id } }),
        prisma.oAuthAccount.findMany({ where: { userId: me.id } }),
        prisma.friendship.findMany({
          where: { OR: [{ userId: me.id }, { friendId: me.id }] },
          include: {
            user: { select: { id: true, displayName: true } },
            friend: { select: { id: true, displayName: true } },
          },
        }),
        prisma.userAchievement.findMany({
          where: { userId: me.id },
          include: { achievement: { select: { slug: true, name: true, description: true } } },
        }),
        prisma.userSeenFact.findMany({
          where: { userId: me.id },
          include: { fact: { select: { id: true, sourceRef: true } } },
        }),
        prisma.matchPlayer.findMany({
          where: { userId: me.id },
          include: {
            match: { select: { id: true, startedAt: true, endedAt: true, cardCount: true } },
            answers: {
              include: {
                matchCard: { select: { position: true, card: { select: { text: true, isTrue: true } } } },
              },
            },
          },
          orderBy: { id: 'asc' },
        }),
        prisma.tournamentParticipant.findMany({
          where: { userId: me.id },
          include: { tournament: { select: { id: true, name: true, status: true, createdAt: true } } },
        }),
      ]);
    if (!user) 
      throw notFound('error.notFound');
    const stats = await computeUserStats(me.id);
    const document = {
      export: {
        generatedAt: new Date().toISOString(),
        application: 'Who knows best? (ft_transcendence)',
        about:
          'Everything stored about this account. The password is held only as an Argon2id hash and is not included.',
      },
      account: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatar: user.avatarUrl,
        locale: user.locale,
        xp: user.xp,
        level: user.level,
        hasPassword: user.passwordHash !== null,
        twoFactorEnabled: user.totpSecret !== null,
        createdAt: user.createdAt,
        onboardedAt: user.onboardedAt,
        lastSeenAt: user.lastSeenAt,
      },
      linkedSignIns: oauth.map((row) => ({
        provider: row.provider,
        providerAccountId: row.providerUserId,
      })),
      friends: friendships.map((row) => ({
        status: row.status,
        direction: row.userId === me.id ? 'sent' : 'received',
        otherPlayer: row.userId === me.id ? row.friend.displayName : row.user.displayName,
        since: row.createdAt,
      })),
      statistics: stats,
      achievements: achievements.map((row) => ({
        slug: row.achievement.slug,
        name: row.achievement.name,
        description: row.achievement.description,
        unlockedAt: row.unlockedAt,
      })),
      matches: players.map((player) => ({
        matchId: player.matchId,
        startedAt: player.match.startedAt,
        endedAt: player.match.endedAt,
        cards: player.match.cardCount,
        score: player.score,
        finalRank: player.finalRank,
        bestCombo: player.comboMax,
        answers: player.answers.map((answer) => ({
          position: answer.matchCard.position,
          statement: answer.matchCard.card.text,
          statementWasTrue: answer.matchCard.card.isTrue,
          youAnswered: answer.choice,
          correct: answer.isCorrect,
          pointsAwarded: answer.pointsAwarded,
          reactionMsReported: answer.clientReactionMs,
          reactionMsAccepted: answer.acceptedReactionMs,
          roundTripMs: answer.rttMs,
          answeredAt: answer.serverReceivedAt,
        })),
      })),
      tournaments: tournaments.map((row) => ({
        id: row.tournament.id,
        name: row.tournament.name,
        status: row.tournament.status,
        seed: row.seed,
        eliminatedAt: row.eliminatedAt,
        joined: row.tournament.createdAt,
      })),
      factsAlreadyShown: seenFacts.map((row) => ({
        factId: row.factId,
        sourceRef: row.fact.sourceRef,
        lastSeenAt: row.lastSeenAt,
      })),
    };

    // Indented on purpose, the format is a readable format and the person opening this in a text editor is who it's for.
    const filename = `wkb-data-${user.displayName.replace(/[^\w.-]+/g, '_')}.json`;
    return reply
      .header('Content-Type', 'application/json; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(JSON.stringify(document, null, 2));
  });
/* Erases the account. One delete cascades to every table that references the user. Tournament columns that hold a user id without a foreign key are nulled first,
so no id is left pointing at a deleted person */
  app.delete('/api/users/me', { 
    preHandler: requireAuth, 
    config: { rateLimit: { max: 30, timeWindow: '10 minutes' } },
  }, async (request, reply) => {
    const me = currentUser(request);
    const input = deleteAccountSchema.parse(request.body);
    const user = await prisma.user.findUnique({ where: { id: me.id } });
    if (!user) 
      throw notFound('error.notFound');
    if (isDemoAccount(user.email))
      throw forbidden();
    // Retyping the display name proves it's intentional, and it's the only confirmation available to accounts with no password (OAuth sign ups)
    if (input.confirm.trim() !== user.displayName) 
    {
      throw badRequest('error.validation', { confirm: 'error.account.confirmMismatch' });
    }
    if (user.passwordHash) 
    {
      if (!input.password) 
      {
        throw badRequest('error.validation', { password: 'validation.password.required' });
      }
      if (!(await verifyPassword(user.passwordHash, input.password))) 
      {
        throw unauthorized('error.auth.wrongPassword');
      }
    }
    await forfeitTournaments(me.id);
    for (const session of activeSessions())
      session.forgetPlayer(me.id);
    await prisma.$transaction([
      prisma.tournamentMatchup.updateMany({ where: { playerAId: me.id }, data: { playerAId: null } }),
      prisma.tournamentMatchup.updateMany({ where: { playerBId: me.id }, data: { playerBId: null } }),
      prisma.tournamentMatchup.updateMany({ where: { winnerId: me.id }, data: { winnerId: null } }),
      prisma.tournament.updateMany({ where: { winnerId: me.id }, data: { winnerId: null } }),
      prisma.tournament.updateMany({ where: { createdById: me.id }, data: { createdById: null } }),
      prisma.user.delete({ where: { id: me.id } }),
    ]);
    // After the delete has committed; had it failed, the account would still be pointing at this file
    await removeUploadedAvatar(user.avatarUrl);
    clearRefreshCookie(reply);
    return { deleted: true };
  });
  app.post('/api/users/me/avatar', { preHandler: requireAuth }, async (request) => {
    const me = currentUser(request);
    const file = await request.file({ limits: { fileSize: AVATAR_MAX_BYTES, files: 1 } });
    if (!file) 
      throw badRequest('error.avatar.missing');
    const buffer = await file.toBuffer().catch(() => {
      throw tooLarge('error.avatar.tooLarge');
    });
    if (buffer.byteLength > AVATAR_MAX_BYTES) 
      throw tooLarge('error.avatar.tooLarge');
    const kind = sniffImage(buffer);
    if (!kind)
      throw badRequest('error.avatar.unsupportedType');
    // The file is served at a public URL, so the EXIF, XMP and text metadata (camera, date, GPS position) is removed first
    const cleaned = stripMetadata(buffer, kind);
    if (!cleaned)
      throw badRequest('error.avatar.unsupportedType');
    const filename = `${randomUUID()}.${EXTENSION[kind]}`;
    const stored = path.join(UPLOAD_DIR, filename);
    await writeFile(stored, cleaned);
    const previous = await prisma.user.findUnique({
      where: { id: me.id },
      select: { avatarUrl: true },
    });
    let user;
    try {
      user = await prisma.user.update({
        where: { id: me.id },
        data: { avatarUrl: `/api/uploads/${filename}` },
      });
    } catch (error) {
      // Nothing points at the new file, so it goes; the old one is untouched and still in use
      await removeUpload(stored);
      throw error;
    }
    // Only now that the profile points at the new file is the old one safe to delete
    await removeUploadedAvatar(previous?.avatarUrl);
    return { avatarUrl: user.avatarUrl };
  });
  app.delete('/api/users/me/avatar', { preHandler: requireAuth }, async (request) => {
    const me = currentUser(request);
    const user = await prisma.user.findUnique({ where: { id: me.id }, select: { avatarUrl: true } });
    await prisma.user.update({ where: { id: me.id }, data: { avatarUrl: null } });
    await removeUploadedAvatar(user?.avatarUrl);
    // Null means "render the default avatar", which the frontend generates from the display name
    return { avatarUrl: null };
  });
  app.get('/api/users', { preHandler: requireAuth }, async (request) => {
    const query = z
      .object({ search: z.string().trim().min(1).max(40).optional() })
      .parse(request.query);
    const live = onlineUserIds();
    const users = await prisma.user.findMany({
      where: {
        isBot: false,
        ...(query.search
          ? { displayName: { contains: query.search, mode: 'insensitive' as const } }
          : {}),
      },
      select: publicProfileSelect,
      orderBy: { displayName: 'asc' },
      take: 25,
    });
    return {
      users: users.map((u) => ({
        ...publicProfile(u),
        online: isOnline(u.id, u.lastSeenAt, live),
      })),
    };
  });
  app.get('/api/users/:id', { preHandler: requireAuth }, async (request) => {
    const { id } = idParam.parse(request.params);
    const user = await prisma.user.findUnique({ where: { id }, select: publicProfileSelect });
    if (!user)
      throw notFound();
    const [stats, history, achievements] = await Promise.all([
      computeUserStats(id),
      matchHistory(id, 15),
      prisma.userAchievement.findMany({
        where: { userId: id },
        include: { achievement: true },
        orderBy: { unlockedAt: 'desc' },
      }),
    ]);
    return {
      user: { ...publicProfile(user), online: isOnline(user.id, user.lastSeenAt, onlineUserIds()) },
      stats,
      history,
      achievements: achievements.map((a) => ({
        slug: a.achievement.slug,
        name: a.achievement.name,
        description: a.achievement.description,
        unlockedAt: a.unlockedAt.toISOString(),
      })),
    };
  });
}
