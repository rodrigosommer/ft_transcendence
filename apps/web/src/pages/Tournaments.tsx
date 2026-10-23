import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DIFFICULTIES, createTournamentSchema, fieldErrors, type Difficulty } from '@wkb/shared';
import { ApiError, api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.js';
import { Alert, Avatar, Button, EmptyState, Field, PageTitle, Spinner } from '../components/ui.js';
import { DeadEnd } from '../components/DeadEnd.js';

interface TournamentRow {
  id: number;
  name: string;
  status: 'registration' | 'running' | 'finished';
  size: number;
  difficulty: Difficulty;
  cardCount: number;
  registered: number;
}

interface BracketPlayer {
  id: number;
  displayName: string;
  avatarUrl: string | null;
  isBot: boolean;
  score: number | null;
}

interface Matchup {
  id: number;
  round: number;
  slot: number;
  status: 'pending' | 'ready' | 'playing' | 'finished';
  roomCode: string | null;
  winnerId: number | null;
  players: BracketPlayer[];
}

interface Bracket {
  id: number;
  name: string;
  status: 'registration' | 'running' | 'finished';
  size: number;
  difficulty: Difficulty;
  cardCount: number;
  winner: { id: number; displayName: string } | null;
  participants: {
    id: number;
    displayName: string;
    avatarUrl: string | null;
    isBot: boolean;
    seed: number;
    eliminated: boolean;
  }[];
  rounds: Matchup[][];
}

const STATUS_STYLE: Record<TournamentRow['status'], string> = {
  registration: 'border-correct/40 bg-correct-wash text-correct',
  running: 'border-spot/35 bg-spot-wash text-spot-strong',
  finished: 'border-rule-strong bg-surface-2 text-muted',
};

export function Tournaments(): JSX.Element {
  const { t } = useTranslation();
  const [rows, setRows] = useState<TournamentRow[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [size, setSize] = useState<4 | 8>(4);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [cardCount, setCardCount] = useState(10);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const navigate = useNavigate();
  const load = useCallback(async () => {
    const payload = await api.get<{ tournaments: TournamentRow[] }>('/api/tournaments');
    setRows(payload.tournaments);
  }, []);
  useEffect(() => {
    void load().catch(() => setRows([]));
  }, [load]);
  const create = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const parsed = createTournamentSchema.safeParse({ name, size, difficulty, cardCount });
    if (!parsed.success) 
    {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setCreating(true);
    try {
      const created = await api.post<{ tournament: Bracket }>('/api/tournaments', parsed.data);
      navigate(`/tournaments/${created.tournament.id}`);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.code : 'error.internal');
    } finally {
      setCreating(false);
    }
  };
  return (
    <div className="mx-auto max-w-3xl animate-fade-up space-y-6">
      <PageTitle title={t('tournament.title')} subtitle={t('tournament.subtitle')} />

      <form className="panel-pad space-y-4" onSubmit={(event) => void create(event)} noValidate>
        <h2 className="text-sm font-semibold text-muted">
          {t('tournament.create')}
        </h2>

        {formError && <Alert>{t(formError)}</Alert>}

        <Field
          label={t('tournament.name')}
          placeholder={t('tournament.namePlaceholder')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={errors.name}
          maxLength={40}
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="tsize">
              {t('tournament.size')}
            </label>
            <select
              id="tsize"
              className="input"
              value={size}
              onChange={(event) => setSize(Number(event.target.value) === 8 ? 8 : 4)}
            >
              <option value={4}>{t('tournament.players', { count: 4 })}</option>
              <option value={8}>{t('tournament.players', { count: 8 })}</option>
            </select>
          </div>

          <div>
            <label className="label" htmlFor="tdiff">
              {t('createRoom.difficulty')}
            </label>
            <select
              id="tdiff"
              className="input"
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value as Difficulty)}
            >
              {DIFFICULTIES.map((value) => (
                <option key={value} value={value}>
                  {t(`difficulty.${value}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="tcards">
              {t('tournament.cardCount')}
            </label>
            <input
              id="tcards"
              className="input"
              type="number"
              min={5}
              max={40}
              value={cardCount}
              onChange={(event) => setCardCount(Number(event.target.value))}
            />
          </div>
        </div>

        <Button type="submit" loading={creating}>
          {t('tournament.create')}
        </Button>
      </form>

      {rows === null ? (
        <div className="flex justify-center py-8">
          <Spinner className="h-6 w-6" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState>{t('tournament.empty')}</EmptyState>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                to={`/tournaments/${row.id}`}
                className="panel flex flex-wrap items-center gap-3 px-4 py-3 transition hover:border-spot hover:bg-surface-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-ink">{row.name}</p>
                  <p className="text-xs text-muted">
                    {t('tournament.registered', { count: row.registered, size: row.size })} ·{' '}
                    {t(`difficulty.${row.difficulty}`)} · {row.cardCount} {t('tournament.cardCount')}
                  </p>
                </div>
                <span className={`chip ${STATUS_STYLE[row.status]}`}>
                  {t(`tournament.status.${row.status}`)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TournamentDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!id) 
      return;
    const payload = await api.get<{ tournament: Bracket }>(`/api/tournaments/${id}`);
    setBracket(payload.tournament);
  }, [id]);
  useEffect(() => {
    void load().catch(() => setError('error.notFound'));
  }, [load]);
  // A running bracket advances when other matches finish elsewhere so poll.
  useEffect(() => {
    if (bracket?.status !== 'running') 
      return undefined;
    const timer = window.setInterval(() => void load().catch(() => undefined), 5000);
    return () => window.clearInterval(timer);
  }, [bracket?.status, load]);
  const act = async (call: () => Promise<unknown>) => {
    setError(null);
    setBusy(true);
    try {
      await call();
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.code : 'error.internal');
    } finally {
      setBusy(false);
    }
  };
  //Reuses the room dead end card, a missing bracket and a missing room are the same case
  if (error && !bracket) 
  {
    return (
      <DeadEnd
        statement={t('dead.tournamentStatement')}
        body={t('dead.tournamentBody')}
        to="/tournaments"
        action={t('dead.backToTournaments')}
        suit="sports"
      />
    );
  }
  if (!bracket) 
  {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  const registered = bracket.participants.some((participant) => participant.id === user?.id);
  const seatsLeft = bracket.size - bracket.participants.length;
  const myReadyMatch = bracket.rounds
    .flat()
    .find(
      (matchup) =>
        (matchup.status === 'ready' || matchup.status === 'playing') &&
        matchup.players.some((player) => player.id === user?.id),
    );
  const roundLabel = (roundIndex: number, total: number) => {
    const fromEnd = total - roundIndex;
    if (fromEnd === 1) 
      return t('tournament.final');
    if (fromEnd === 2) 
      return t('tournament.semifinal');
    if (fromEnd === 3) 
      return t('tournament.quarterfinal');
    return t('tournament.round', { number: roundIndex + 1 });
  };
  return (
    <div className="mx-auto max-w-4xl animate-fade-up space-y-6">
      <PageTitle
        title={bracket.name}
        subtitle={`${t(`difficulty.${bracket.difficulty}`)} · ${bracket.cardCount} ${t('tournament.cardCount')}`}
        action={<span className={`chip ${STATUS_STYLE[bracket.status]}`}>{t(`tournament.status.${bracket.status}`)}</span>}
      />

      {error && <Alert>{t(error)}</Alert>}

      {bracket.winner && (
        <Alert tone="success">{t('tournament.champion', { name: bracket.winner.displayName })}</Alert>
      )}

      {myReadyMatch?.roomCode && (
        <Alert tone="info">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{t('tournament.yourMatch')}</span>
            <Link
              to={`/room/${myReadyMatch.roomCode}`}
              className="rounded-lg bg-spot px-3 py-1.5 text-xs font-medium text-surface"
            >
              {t('tournament.joinMatch')}
            </Link>
          </div>
        </Alert>
      )}

      {bracket.status === 'registration' && (
        <div className="panel-pad space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-soft">
              {t('tournament.registered', { count: bracket.participants.length, size: bracket.size })}
            </p>
            <div className="flex flex-wrap gap-2">
              {registered ? (
                <Button variant="ghost" disabled={busy} onClick={() => void act(() => api.del(`/api/tournaments/${id}/leave`))}>
                  {t('tournament.leave')}
                </Button>
              ) : (
                <Button disabled={busy || seatsLeft <= 0} onClick={() => void act(() => api.post(`/api/tournaments/${id}/join`))}>
                  {t('tournament.join')}
                </Button>
              )}
              {seatsLeft > 0 && (
                <Button variant="secondary" disabled={busy} onClick={() => void act(() => api.post(`/api/tournaments/${id}/fill`))}>
                  {t('tournament.fillWithBots')}
                </Button>
              )}
              {seatsLeft === 0 && (
                <Button disabled={busy} onClick={() => void act(() => api.post(`/api/tournaments/${id}/start`))}>
                  {t('tournament.start')}
                </Button>
              )}
            </div>
          </div>

          <ul className="flex flex-wrap gap-2">
            {bracket.participants.map((participant) => (
              <li key={participant.id} className="flex items-center gap-2 rounded border border-rule bg-surface py-1 pl-1 pr-3">
                <Avatar name={participant.displayName} src={participant.avatarUrl} size={24} />
                <span className="text-xs text-ink-soft">{participant.displayName}</span>
              </li>
            ))}
            {Array.from({ length: Math.max(0, seatsLeft) }, (_, index) => (
              <li
                key={`empty-${index}`}
                className="rounded border border-dashed border-rule-strong px-4 py-1.5 text-xs text-muted"
              >
                —
              </li>
            ))}
          </ul>

          <p className="text-xs text-muted">{t('tournament.byes')}</p>
        </div>
      )}

      {bracket.rounds.some((round) => round.length > 0) && (
        <div className="panel-pad">
          <h2 className="mb-4 text-sm font-semibold text-muted">
            {t('tournament.bracket')}
          </h2>

          <div className="flex gap-4 overflow-x-auto pb-2">
            {bracket.rounds.map((round, roundIndex) => (
              <div key={roundIndex} className="min-w-[15rem] flex-1 space-y-3">
                <p className="text-xs font-semibold text-muted">
                  {roundLabel(roundIndex, bracket.rounds.length)}
                </p>

                {round.map((matchup) => (
                  <div key={matchup.id} className="rounded-xl border border-rule bg-surface p-2.5">
                    {matchup.players.length === 0 ? (
                      <p className="py-3 text-center text-xs text-muted">{t('tournament.waiting')}</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {matchup.players.map((player) => {
                          const won = matchup.winnerId === player.id;
                          return (
                            <li
                              key={player.id}
                              className={[
                                'flex items-center gap-2 rounded-lg px-2 py-1.5',
                                won ? 'bg-correct-wash' : matchup.status === 'finished' ? 'opacity-50' : '',
                              ].join(' ')}
                            >
                              <Avatar name={player.displayName} src={player.avatarUrl} size={22} />
                              <span className="min-w-0 flex-1 truncate text-xs text-ink">
                                {player.displayName}
                              </span>
                              {player.score !== null && (
                                <span className="text-xs tabular-nums text-muted">{player.score}</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    <p className="mt-2 text-center text-[11px] text-muted">
                      {t(
                        matchup.status === 'finished'
                          ? 'tournament.finishedMatch'
                          : matchup.status === 'playing'
                            ? 'tournament.playing'
                            : matchup.status === 'ready'
                              ? 'tournament.ready'
                              : 'tournament.waiting',
                      )}
                    </p>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs text-muted">{t('tournament.botMatchNote')}</p>
        </div>
      )}
    </div>
  );
}
