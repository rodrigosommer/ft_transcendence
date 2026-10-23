import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { currentUser, requireAuth } from '../plugins/auth.js';
import { computeUserStats, leaderboard, matchHistory } from '../services/stats.js';

export async function statsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/stats/me', { preHandler: requireAuth }, async (request) => {
    const me = currentUser(request);
    const [stats, history] = await Promise.all([computeUserStats(me.id), matchHistory(me.id, 25)]);
    return { stats, history };
  });
  app.get('/api/stats/leaderboard', { preHandler: requireAuth }, async () => ({
    leaderboard: await leaderboard(25),
  }));
  //Every achievement, with the ones this user has unlocked marked
  app.get('/api/stats/achievements', { preHandler: requireAuth }, async (request) => {
    const me = currentUser(request);
    const [all, mine] = await Promise.all([
      prisma.achievement.findMany({ orderBy: { id: 'asc' } }),
      prisma.userAchievement.findMany({ where: { userId: me.id } }),
    ]);
    const unlocked = new Map(mine.map((u) => [u.achievementId, u.unlockedAt]));
    return {
      achievements: all.map((a) => ({
        slug: a.slug,
        name: a.name,
        description: a.description,
        unlockedAt: unlocked.get(a.id)?.toISOString() ?? null,
      })),
    };
  });
}
