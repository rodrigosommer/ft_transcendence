import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.js';
import { Avatar, EmptyState, PageTitle, Spinner } from '../components/ui.js';

interface Row {
  userId: number;
  displayName: string;
  avatarUrl: string | null;
  level: number;
  xp: number;
  matchesPlayed: number;
  matchesWon: number;
  totalScore: number;
  accuracy: number;
}

export function Leaderboard(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api
      .get<{ leaderboard: Row[] }>('/api/stats/leaderboard')
      .then((payload) => {
        if (!cancelled) 
          setRows(payload.leaderboard);
      })
      .catch(() => {
        if (!cancelled) 
          setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  if (rows === null) 
  {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  return (
    <div className="animate-fade-up">
      <PageTitle title={t('leaderboard.title')} subtitle={t('leaderboard.subtitle')} />

      {rows.length === 0 ? (
        <EmptyState>{t('leaderboard.empty')}</EmptyState>
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem]">
              <thead className="border-b border-rule">
                <tr>
                  <th className="table-head w-10">#</th>
                  <th className="table-head">{t('leaderboard.player')}</th>
                  <th className="table-head text-right">{t('leaderboard.matches')}</th>
                  <th className="table-head text-right">{t('leaderboard.wins')}</th>
                  <th className="table-head text-right">{t('leaderboard.accuracy')}</th>
                  <th className="table-head text-right">{t('leaderboard.score')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {rows.map((row, index) => (
                  <tr key={row.userId} className={row.userId === user?.id ? 'bg-spot-wash' : ''}>
                    <td className="table-cell font-semibold tabular-nums text-muted">{index + 1}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={row.displayName} src={row.avatarUrl} size={28} />
                        <div className="min-w-0">
                          <p className="truncate text-sm text-ink">{row.displayName}</p>
                          <p className="text-[11px] text-muted">
                            {t('common.level')} {row.level}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell text-right tabular-nums text-muted">{row.matchesPlayed}</td>
                    <td className="table-cell text-right tabular-nums text-muted">{row.matchesWon}</td>
                    <td className="table-cell text-right tabular-nums text-muted">
                      {Math.round(row.accuracy * 100)}%
                    </td>
                    <td className="table-cell text-right font-semibold tabular-nums text-ink">
                      {row.totalScore}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
