import type { MatchAward } from '@wkb/shared';
import { levelFromXp } from '@wkb/shared';
import { prisma } from '../db.js';
import { computeUserStats } from './stats.js';

/*XP with levels, achievements, and the leaderboard they both feed. Everything is saved to the database, and nothing is recalculated from a cache
Showing up earns a little XP and placing well earns more */

const XP_FOR_PLAYING = 20;
const XP_PER_100_POINTS = 10;
const XP_BY_RANK: Record<number, number> = { 1: 50, 2: 25, 3: 10 };

export function xpForMatch(params: { score: number; rank: number | null }): number {
  const fromScore = Math.max(0, Math.round((params.score / 100) * XP_PER_100_POINTS));
  const fromRank = params.rank ? (XP_BY_RANK[params.rank] ?? 0) : 0;
  return XP_FOR_PLAYING + fromScore + fromRank;
}

interface Criteria {
  kind:
    | 'matches_played'
    | 'matches_won'
    | 'correct_answers'
    | 'best_combo'
    | 'accuracy'
    | 'level'
    | 'perfect_match'
    | 'fast_correct'
    | 'category_correct';
  threshold?: number;
  categorySlug?: string;
  //For 'accuracy', the minimum number of answers before the rule can trigger
  minAnswers?: number;
}

type RewardContext = Awaited<ReturnType<typeof loadRewardContext>>;

// Everything the achievement rules read. None of it is changed by granting the rewards, so it can be read before the transaction
async function loadRewardContext(userId: number, matchId: number) {
  const [stats, achievements, matchAnswers] = await Promise.all([
    computeUserStats(userId),
    prisma.achievement.findMany(),
    prisma.answer.findMany({
      where: { matchPlayer: { userId, matchId } },
      select: { isCorrect: true, acceptedReactionMs: true },
    }),
  ]);
  return { stats, achievements, matchAnswers };
}

/* Achievement rules are in the 'achievements.criteria' JSON, which this function reads. Adding a badge means changing the seed, not deploying*/
function unlockedSlugs(context: RewardContext, level: number): string[] {
  const { stats, achievements, matchAnswers } = context;
  const answeredEverything = matchAnswers.length > 0;
  const perfectMatch = answeredEverything && matchAnswers.every((a) => a.isCorrect);
  const fastestThisMatch = matchAnswers
    .filter((a) => a.isCorrect)
    .reduce<number | null>(
      (best, a) => (best === null ? a.acceptedReactionMs : Math.min(best, a.acceptedReactionMs)),
      null,
    );
  const earned: string[] = [];
  for (const achievement of achievements) 
  {
    const criteria = achievement.criteria as unknown as Criteria;
    const threshold = criteria.threshold ?? 0;
    let met = false;
    switch (criteria.kind) {
      case 'matches_played':
        met = stats.matchesPlayed >= threshold;
        break;
      case 'matches_won':
        met = stats.matchesWon >= threshold;
        break;
      case 'correct_answers':
        met = stats.correct >= threshold;
        break;
      case 'best_combo':
        met = stats.bestCombo >= threshold;
        break;
      case 'accuracy':
        met = stats.answers >= (criteria.minAnswers ?? 50) && stats.accuracy >= threshold;
        break;
      case 'level':
        met = level >= threshold;
        break;
      case 'perfect_match':
        met = perfectMatch && matchAnswers.length >= (criteria.minAnswers ?? 10);
        break;
      case 'fast_correct':
        met = fastestThisMatch !== null && fastestThisMatch <= threshold;
        break;
      case 'category_correct': {
        const row = stats.byCategory.find((c) => c.slug === criteria.categorySlug);
        met = (row?.correct ?? 0) >= threshold;
        break;
      }
      default:
        met = false;
    }
    if (met) 
      earned.push(achievement.slug);
  }
  return earned;
}

// Awards XP and achievements for a finished match. Bots aren't included
export async function grantMatchRewards(matchId: number): Promise<MatchAward[]> {
  const players = await prisma.matchPlayer.findMany({
    where: { matchId },
    include: { user: { select: { id: true, isBot: true, xp: true } } },
  });
  const awards: MatchAward[] = [];
  for (const player of players) 
  {
    if (player.user.isBot)
      continue;
    const xpGained = xpForMatch({ score: player.score, rank: player.finalRank });
    const context = await loadRewardContext(player.userId, matchId);
    /* One transaction per player, so the XP, the level and the new achievements are saved together or not at all.
    Separate writes could fail half way and leave, say, the XP added but the level or the badges missing */
    const award = await prisma.$transaction(async (tx) => {
      // The database adds the XP itself
      const updated = await tx.user.update({
        where: { id: player.userId },
        data: { xp: { increment: xpGained } },
        select: { xp: true },
      });
      const xpAfter = updated.xp;
      const levelBefore = levelFromXp(xpAfter - xpGained);
      const levelAfter = levelFromXp(xpAfter);
      await tx.user.update({
        where: { id: player.userId },
        data: { level: levelAfter },
      });
      const slugs = new Set(unlockedSlugs(context, levelAfter));
      const newlyUnlocked: MatchAward['achievements'] = [];
      for (const achievement of context.achievements)
      {
        if (!slugs.has(achievement.slug))
          continue;
        // One row at a time: 'count' then says whether this one is new, and the client wants to celebrate exactly the new ones
        const created = await tx.userAchievement.createMany({
          data: [{ userId: player.userId, achievementId: achievement.id }],
          skipDuplicates: true,
        });
        if (created.count > 0)
        {
          newlyUnlocked.push({
            slug: achievement.slug,
            name: achievement.name,
            description: achievement.description,
          });
        }
      }
      return { userId: player.userId, xpGained, levelBefore, levelAfter, achievements: newlyUnlocked };
    });
    awards.push(award);
  }
  return awards;
}
