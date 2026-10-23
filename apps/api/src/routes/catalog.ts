import { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { requireAuth } from '../plugins/auth.js';

// Reference data the room creation and lobby screens need
export async function catalogRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/catalog/categories', { preHandler: requireAuth }, async () => {
    const rows = await prisma.$queryRaw<
      { id: number; slug: string; name: string; easy: bigint; medium: bigint; hard: bigint }[]
    >(Prisma.sql`
      SELECT c.id,
             c.slug,
             c.name,
             count(*) FILTER (WHERE f.difficulty = 'easy')   AS easy,
             count(*) FILTER (WHERE f.difficulty = 'medium') AS medium,
             count(*) FILTER (WHERE f.difficulty = 'hard')   AS hard
      FROM categories c
      LEFT JOIN facts f ON f.category_id = c.id AND f.active
      GROUP BY c.id, c.slug, c.name
      ORDER BY c.name ASC
    `);
    return {
      categories: rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        facts: { easy: Number(r.easy), medium: Number(r.medium), hard: Number(r.hard) },
      })),
    };
  });
  app.get('/api/catalog/bots', { preHandler: requireAuth }, async () => {
    const bots = await prisma.botProfile.findMany({
      include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
      orderBy: { reactionMsMean: 'asc' },
    });
    return {
      bots: bots.map((b) => {
        const accuracy = b.accuracyByCategory as Record<string, number>;
        const values = Object.entries(accuracy)
          .filter(([key]) => key !== '_default')
          .map(([, value]) => value);
        const average =
          values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : (accuracy['_default'] ?? 0.6);
        return {
          profileId: b.id,
          userId: b.user.id,
          displayName: b.user.displayName,
          avatarUrl: b.user.avatarUrl,
          label: b.label,
          averageAccuracy: Number(average.toFixed(2)),
          reactionMsMean: b.reactionMsMean,
          //Strongest categories so the lobby can describe the opponent.
          strengths: Object.entries(accuracy)
            .filter(([key]) => key !== '_default')
            .sort((a, b2) => b2[1] - a[1])
            .slice(0, 2)
            .map(([slug]) => slug),
        };
      }),
    };
  });
 // Card set size, used by the customisation screen (check README.md)
  app.get('/api/catalog/cards', { preHandler: requireAuth }, async () => {
    const [facts, cards, translations] = await Promise.all([
      prisma.facts.count({ where: { active: true } }),
      prisma.card.count(),
      prisma.cardTranslation.groupBy({ by: ['locale'], _count: { locale: true } }),
    ]);
    return {
      facts,
      cards,
      translations: Object.fromEntries(translations.map((t) => [t.locale, t._count.locale])),
    };
  });
}
