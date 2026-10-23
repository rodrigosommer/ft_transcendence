import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import { EmptyState, PageTitle, Spinner } from '../components/ui.js';

interface CategoryAccuracy {
  slug: string;
  name: string;
  answers: number;
  correct: number;
  accuracy: number;
}

interface UserStats {
  matchesPlayed: number;
  matchesWon: number;
  losses: number;
  winRate: number;
  totalScore: number;
  bestScore: number;
  answers: number;
  correct: number;
  accuracy: number;
  bestCombo: number;
  fastestCorrectMs: number | null;
  byCategory: CategoryAccuracy[];
}

interface HistoryRow {
  matchId: number;
  roomName: string;
  endedAt: string | null;
  score: number;
  rank: number | null;
  playerCount: number;
  difficulty: string;
  opponents: { id: number; displayName: string; isBot: boolean; score: number; rank: number | null }[];
}

interface AchievementRow {
  slug: string;
  name: string;
  description: string;
  unlockedAt: string | null;
}

function Stat({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <div className="panel px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}

// A compact sparkline of the last matches; no chart library needed
function Progression({ rows }: { rows: HistoryRow[] }): JSX.Element {
  const { t } = useTranslation();
  const points = [...rows].reverse();
  if (points.length < 2) 
    return <></>;
  const max = Math.max(...points.map((row) => row.score), 1);
  const min = Math.min(...points.map((row) => row.score), 0);
  const span = Math.max(1, max - min);
  const path = points
    .map((row, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 100 - ((row.score - min) / span) * 100;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
  return (
    <div className="panel-pad">
      <h2 className="mb-3 text-sm font-semibold text-muted">
        {t('stats.progressionTitle')}
      </h2>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-24 w-full" role="img" aria-label={t('stats.progressionTitle')}>
        <path d={`${path} L100,100 L0,100 Z`} className="fill-spot-wash" />
        <path d={path} fill="none" className="stroke-spot" strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-[11px] tabular-nums text-muted">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

export function Stats(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [achievements, setAchievements] = useState<AchievementRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [mine, badges] = await Promise.all([
          api.get<{ stats: UserStats; history: HistoryRow[] }>('/api/stats/me'),
          api.get<{ achievements: AchievementRow[] }>('/api/stats/achievements'),
        ]);
        if (cancelled) 
          return;
        setStats(mine.stats);
        setHistory(mine.history);
        setAchievements(badges.achievements);
      } finally {
        if (!cancelled) 
          setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) 
  {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  if (!stats) 
    return <EmptyState>{t('stats.noHistory')}</EmptyState>;
  const percent = (value: number) => `${Math.round(value * 100)}%`;
  const dateOf = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(i18n.language, { day: '2-digit', month: 'short' }) : '—';
  return (
    <div className="animate-fade-up space-y-6">
      <PageTitle title={t('stats.title')} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label={t('stats.matches')} value={stats.matchesPlayed} />
        <Stat label={t('stats.wins')} value={stats.matchesWon} />
        <Stat label={t('stats.losses')} value={stats.losses} />
        <Stat label={t('stats.winRate')} value={percent(stats.winRate)} />
        <Stat label={t('stats.accuracy')} value={percent(stats.accuracy)} />
        <Stat label={t('stats.bestCombo')} value={stats.bestCombo} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t('stats.answers')} value={stats.answers} />
        <Stat label={t('stats.totalScore')} value={stats.totalScore} />
        <Stat label={t('stats.bestScore')} value={stats.bestScore} />
        <Stat
          label={t('stats.fastestCorrect')}
          value={stats.fastestCorrectMs === null ? '—' : `${(stats.fastestCorrectMs / 1000).toFixed(2)}s`}
        />
      </div>

      {history.length >= 2 && <Progression rows={history} />}

      {stats.byCategory.length > 0 && (
        <div className="panel-pad">
          <h2 className="mb-4 text-sm font-semibold text-muted">
            {t('stats.byCategory')}
          </h2>
          <ul className="space-y-3">
            {stats.byCategory.map((category) => (
              <li key={category.slug}>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span className="text-ink-soft">
                    {t(`categories.${category.slug}`, { defaultValue: category.name })}
                  </span>
                  <span className="tabular-nums text-muted">
                    {category.correct}/{category.answers} · {percent(category.accuracy)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden bg-surface-2">
                  <div
                    className="h-full bg-spot"
                    style={{ width: `${Math.round(category.accuracy * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="panel-pad">
        <h2 className="mb-4 text-sm font-semibold text-muted">
          {t('stats.achievements')}
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {achievements.map((achievement) => (
            <li
              key={achievement.slug}
              className={[
                'rounded-xl border px-3 py-2.5',
                achievement.unlockedAt
                  ? 'border-spot/35 bg-spot-wash'
                  : 'border-rule bg-surface opacity-55',
              ].join(' ')}
            >
              <p className={`text-sm font-medium ${achievement.unlockedAt ? 'text-ink' : 'text-muted'}`}>
                {t(`achievements.${achievement.slug}.name`, { defaultValue: achievement.name })}
              </p>
              <p className="text-xs text-muted">
                {t(`achievements.${achievement.slug}.description`, {
                  defaultValue: achievement.description,
                })}
              </p>
              <p className="mt-1 text-[11px] text-muted">
                {achievement.unlockedAt
                  ? t('stats.unlockedOn', { date: dateOf(achievement.unlockedAt) })
                  : t('stats.locked')}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel overflow-hidden">
        <h2 className="border-b border-rule px-4 py-3 text-sm font-semibold text-muted">
          {t('stats.history')}
        </h2>

        {history.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">{t('stats.noHistory')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem]">
              <thead className="border-b border-rule">
                <tr>
                  <th className="table-head">{t('stats.date')}</th>
                  <th className="table-head">{t('createRoom.name')}</th>
                  <th className="table-head">{t('stats.rank')}</th>
                  <th className="table-head">{t('leaderboard.score')}</th>
                  <th className="table-head">{t('stats.opponents')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {history.map((row) => (
                  <tr key={row.matchId}>
                    <td className="table-cell whitespace-nowrap text-muted">{dateOf(row.endedAt)}</td>
                    <td className="table-cell text-ink">
                      {row.roomName}
                      <span className="ml-1.5 text-xs text-muted">
                        {t(`difficulty.${row.difficulty}`)}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span
                        className={[
                          'inline-block rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums',
                          row.rank === 1 ? 'bg-correct-wash text-correct' : 'bg-surface-2 text-muted',
                        ].join(' ')}
                      >
                        {row.rank ?? '—'}/{row.playerCount}
                      </span>
                    </td>
                    <td className="table-cell tabular-nums text-ink">{row.score}</td>
                    <td className="table-cell text-xs text-muted">
                      {row.opponents.map((opponent) => opponent.displayName).join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
