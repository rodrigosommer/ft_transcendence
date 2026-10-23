import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MATCH_COUNTDOWN_MS, type RoomSettingsPayload } from '@wkb/shared';
import { api } from '../api/client.js';
import { useAuth, type SessionUser } from '../auth/AuthContext.js';
import { useRoomChannel, type RoomChannel } from '../ws/useRoomChannel.js';
import { Alert, Avatar, Button, Spinner } from '../components/ui.js';
import { CardFace, Scoreboard, TimerBar, VoteButtons } from '../components/game.js';
import { ConnectionLost } from '../components/ConnectionLost.js';
import { DeadEnd } from '../components/DeadEnd.js';

interface BotRow {
  profileId: number;
  userId: number;
  displayName: string;
  label: string;
  averageAccuracy: number;
  reactionMsMean: number;
  strengths: string[];
}

export function Room(): JSX.Element {
  const { code } = useParams<{ code: string }>();
  const channel = useRoomChannel(code ?? null);
  const { t } = useTranslation();
  /* No timed redirect; these cases show a screen explaining what happened, and a 1800ms bounce would cut off the reading. 
  The card text depends on which false belief brought the player here. The verdict is always Myth, since in all three cases the room isn't there.*/
  const deadEnd = (): { statement: string; body: string } | null => {
    if (!code) 
      return { statement: t('dead.roomStatement', { code: '??????' }), body: t('dead.roomBody') };
    switch (channel.error) {
      case 'error.room.removed':
        return { statement: t('dead.removedStatement'), body: t('dead.removedBody') };
      case 'error.room.full':
        return { statement: t('dead.fullStatement'), body: t('dead.fullBody') };
      case 'error.room.notFound':
        return { statement: t('dead.roomStatement', { code }), body: t('dead.roomBody') };
      default:
        return null;
    }
  };
  const dead = deadEnd();
  if (dead) 
    {
    return (
      <DeadEnd
        statement={dead.statement}
        body={dead.body}
        to="/play"
        action={t('dead.backToLobby')}
      />
    );
  }
  if (!channel.room) 
  {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted">
        {channel.error ? (
          <Alert>{t(channel.error)}</Alert>
        ) : (
          <>
            <Spinner className="h-6 w-6" />
            <p className="text-sm">{t('lobby.connecting')}</p>
          </>
        )}
      </div>
    );
  }
  const inMatch = channel.phase !== null && channel.phase !== 'scoreboard';
  // Only once a room has been seen, before that the spinner above is already saying the same thing
  const away = channel.status !== 'open';
  return (
   // The wrapper isn't animated because each view and banner below already has its own entrance and animating both made them stack.
    <div>
      <ConnectionLost away={away} />

      {channel.error && (
        <div className="mb-4 animate-fade-up">
          <Alert>
            <div className="flex items-center justify-between gap-3">
              <span>{t(channel.error)}</span>
              <button type="button" onClick={channel.dismissError} className="-my-1 shrink-0 px-2 py-1 text-xs underline">
                {t('common.close')}
              </button>
            </div>
          </Alert>
        </div>
      )}

      {channel.becameHost && (
        <div className="mb-4 animate-fade-up">
          <Alert tone="info">
            <div className="flex items-center justify-between gap-3">
              <span>{t('room.nowHost')}</span>
              <button type="button" onClick={channel.dismissHostNotice} className="-my-1 shrink-0 px-2 py-1 text-xs underline">
                {t('common.close')}
              </button>
            </div>
          </Alert>
        </div>
      )}

      {channel.ended ? (
        <FinalScoreboard channel={channel} />
      ) : inMatch ? (
        <MatchView channel={channel} />
      ) : (
        <RoomLobby channel={channel} />
      )}
    </div>
  );
}

// Lobby before the match starts
function RoomLobby({ channel }: { channel: RoomChannel }): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [bots, setBots] = useState<BotRow[]>([]);
  const [copied, setCopied] = useState(false);
  const isHost = channel.hostUserId === channel.youId;
  const room = channel.room;
  useEffect(() => {
    let cancelled = false;
    void api
      .get<{ bots: BotRow[] }>('/api/catalog/bots')
      .then((payload) => {
        if (!cancelled) 
          setBots(payload.bots);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  const inRoom = new Set(channel.players.map((player) => player.id));
  const copyCode = () => {
    if (!room) 
      return;
    void navigator.clipboard
      ?.writeText(room.code)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => undefined);
  };
  const leave = () => {
    channel.leave();
    navigate('/play');
  };
  if (!room) 
    return <Spinner />;
  return (
    <div className="animate-fade-up grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <div className="panel-pad">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-ink">{room.name}</h1>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="chip">{t(`difficulty.${room.difficulty}`)}</span>
                <span className="chip">
                  {t('createRoom.cardCount')}: {channel.settings?.cardCount}
                </span>
                <span className="chip">
                  {((channel.settings?.answerWindowMs ?? 0) / 1000).toFixed(0)}
                  {t('common.seconds')}
                </span>
                {channel.settings?.comboEnabled && <span className="chip">{t('createRoom.comboEnabled')}</span>}
                {channel.settings?.doubleCardEnabled && (
                  <span className="chip border-spot/35 bg-spot-wash text-spot-strong">
                    {t('createRoom.doubleCardEnabled')}
                  </span>
                )}
                {room.categories.map((category) => (
                  <span key={category.slug} className="chip chip-accent">
                    {t(`categories.${category.slug}`, { defaultValue: category.name })}
                  </span>
                ))}
              </div>
            </div>

            <div className="text-right">
              <p className="text-xs text-muted">{t('room.code')}</p>
              <button
                type="button"
                onClick={copyCode}
                className="font-mono text-2xl font-semibold tracking-widest text-spot transition hover:text-spot-strong"
                title={t('common.copy')}
              >
                {room.code}
              </button>
              <p className="mt-0.5 text-xs text-muted">
                {copied ? t('common.copied') : t('room.shareHint')}
              </p>
            </div>
          </div>
        </div>

        <div className="panel-pad">
          <h2 className="mb-4 text-sm font-semibold text-muted">
            {t('room.players')} ({channel.players.length}/{room.maxPlayers})
          </h2>

          <ul className="space-y-2">
            {channel.players.map((player) => (
              <li
                key={player.id}
                className="flex items-center gap-3 rounded-xl border border-rule bg-surface px-3 py-2.5"
              >
                <Avatar name={player.displayName} src={player.avatarUrl} size={34} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {player.displayName}
                    {player.id === channel.youId && (
                      <span className="ml-1.5 text-xs text-spot">({t('common.you')})</span>
                    )}
                  </p>
                  <p className="text-xs text-muted">
                    {player.isBot ? t('common.bot') : `${t('common.level')} ${player.level}`}
                    {player.id === channel.hostUserId && ` · ${t('room.host')}`}
                  </p>
                </div>
                {isHost && player.id !== channel.youId && (
                  <button
                    type="button"
                    onClick={() => channel.removePlayer(player.id)}
                    className="rounded-lg px-2 py-1 text-xs text-muted transition hover:bg-wrong-wash hover:text-wrong"
                  >
                    {t('common.remove')}
                  </button>
                )}
              </li>
            ))}
          </ul>

          {channel.players.length < 2 && (
            <p className="mt-3 text-xs text-spot-strong">{t('room.needMorePlayers')}</p>
          )}
        </div>

        {isHost && (
          <div className="panel-pad">
            <h2 className="mb-1 text-sm font-semibold text-muted">
              {t('room.opponents')}
            </h2>
            <p className="mb-4 text-xs text-muted">{t('room.addOpponent')}</p>

            <ul className="grid gap-2 sm:grid-cols-2">
              {bots.map((bot) => {
                const already = inRoom.has(bot.userId);
                return (
                  <li key={bot.profileId}>
                    <button
                      type="button"
                      disabled={already || channel.players.length >= room.maxPlayers}
                      onClick={() => channel.addBot(bot.profileId)}
                      className={[
                        'w-full rounded-xl border p-3 text-left transition',
                        already
                          ? 'cursor-not-allowed border-rule bg-surface opacity-45'
                          : 'border-rule-strong bg-surface hover:border-spot hover:bg-surface-2',
                      ].join(' ')}
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar name={bot.displayName} size={30} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">{bot.displayName}</p>
                          <p className="truncate text-xs text-muted">{t(bot.label)}</p>
                        </div>
                      </div>
                      <p className="mt-2 text-[11px] text-muted">
                        {t('room.botStrength', {
                          value: Math.round(bot.averageAccuracy * 100),
                          ms: (bot.reactionMsMean / 1000).toFixed(1),
                        })}
                      </p>
                      {bot.strengths.length > 0 && (
                        <p className="text-[11px] text-muted">
                          {t('room.botStrengths', {
                            list: bot.strengths
                              .map((slug) => t(`categories.${slug}`, { defaultValue: slug }))
                              .join(', '),
                          })}
                        </p>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <aside className="space-y-4">
        <div className="panel-pad">
          {isHost ? (
            <>
              <Button fullWidth onClick={channel.start} disabled={channel.players.length < 2}>
                {t('room.start')}
              </Button>
              <p className="hint text-center">{t('room.startHint')}</p>
            </>
          ) : (
            <p className="text-center text-sm text-muted">{t('room.waitingForHost')}</p>
          )}

          <Button variant="ghost" fullWidth className="mt-3" onClick={leave}>
            {t('room.leave')}
          </Button>
        </div>

        {isHost && channel.settings && (
          <SettingsEditor settings={channel.settings} onSave={channel.updateSettings} />
        )}
      </aside>
    </div>
  );
}

// The host can retune the room without having to recreat it
function SettingsEditor({
  settings,
  onSave,
}: {
  settings: RoomSettingsPayload;
  onSave: (next: RoomSettingsPayload) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(settings);
  const [saved, setSaved] = useState(false);
  useEffect(() => setDraft(settings), [settings]);
  const save = () => {
    onSave(draft);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(settings), [draft, settings]);
  return (
    <div className="panel-pad">
      <h2 className="mb-4 text-sm font-semibold text-muted">
        {t('room.editSettings')}
      </h2>

      <label className="label" htmlFor="rs-cards">
        {t('createRoom.cardCount')}: <span className="tabular-nums text-spot">{draft.cardCount}</span>
      </label>
      <input
        id="rs-cards"
        type="range"
        min={5}
        max={40}
        value={draft.cardCount}
        onChange={(event) => setDraft({ ...draft, cardCount: Number(event.target.value) })}
        className="slider mb-3"
      />

      <label className="label" htmlFor="rs-window">
        {t('createRoom.answerWindow')}:{' '}
        <span className="tabular-nums text-spot">{(draft.answerWindowMs / 1000).toFixed(0)}s</span>
      </label>
      <input
        id="rs-window"
        type="range"
        min={3000}
        max={30000}
        step={1000}
        value={draft.answerWindowMs}
        onChange={(event) => setDraft({ ...draft, answerWindowMs: Number(event.target.value) })}
        className="slider mb-3"
      />

      <label className="mb-2 flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={draft.comboEnabled}
          onChange={(event) => setDraft({ ...draft, comboEnabled: event.target.checked })}
          className="h-4 w-4 accent-spot"
        />
        {t('createRoom.comboEnabled')}
      </label>
      <label className="mb-4 flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={draft.doubleCardEnabled}
          onChange={(event) => setDraft({ ...draft, doubleCardEnabled: event.target.checked })}
          className="h-4 w-4 accent-spot"
        />
        {t('createRoom.doubleCardEnabled')}
      </label>

      <Button variant="secondary" fullWidth onClick={save} disabled={!dirty}>
        {saved ? t('room.settingsSaved') : t('common.save')}
      </Button>
    </div>
  );
}

// The match
function MatchView({ channel }: { channel: RoomChannel }): JSX.Element {
  const { t } = useTranslation();
  if (channel.phase === 'countdown') 
  {
    return <Countdown />;
  }
  const { card, reveal, myVote, renderedAt } = channel;
  if (!card) 
  {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  const revealing = reveal !== null && reveal.matchCardId === card.matchCardId;
  const myResult = revealing ? reveal.results.find((result) => result.userId === channel.youId) : undefined;
  return (
    <div className="animate-fade-up grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted">
            {t('match.cardOf', { position: card.position, total: card.total })}
          </p>
          <div className="h-1 flex-1 overflow-hidden bg-surface-2">
            <div
              className="h-full bg-spot transition-[width] duration-500"
              style={{ width: `${(card.position / card.total) * 100}%` }}
            />
          </div>
        </div>

        {/*Keyed on the card so the deal animation replays for every card */}
        <CardFace key={card.matchCardId} card={card} dimmed={revealing} />

        {revealing ? (
          <RevealPanel channel={channel} />
        ) : (
          <>
            {renderedAt !== null && (
              <TimerBar startedAt={renderedAt} windowMs={card.windowMs} paused={myVote !== null} />
            )}

            <VoteButtons onVote={channel.vote} chosen={myVote} disabled={myVote !== null} />

            {myVote !== null && (
              <p className="text-center text-sm text-muted">{t('match.waiting')}</p>
            )}
          </>
        )}

        {revealing && myResult && !myResult.reactionTrusted && myResult.choice !== null && (
          <p className="text-center text-xs text-spot-strong">{t('match.reactionUntrusted')}</p>
        )}
      </div>

      <aside>
        <Scoreboard entries={channel.scoreboard} youId={channel.youId} />
      </aside>
    </div>
  );
}

function Countdown(): JSX.Element {
  const { t } = useTranslation();
  const [remaining, setRemaining] = useState(MATCH_COUNTDOWN_MS);

  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      setRemaining(Math.max(0, MATCH_COUNTDOWN_MS - (Date.now() - started)));
    }, 100);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <p className="text-sm text-muted">{t('match.countdown')}</p>
      <p className="animate-reveal text-7xl font-semibold text-spot tabular-nums">
        {Math.ceil(remaining / 1000)}
      </p>
    </div>
  );
}

function RevealPanel({ channel }: { channel: RoomChannel }): JSX.Element {
  const { t } = useTranslation();
  const reveal = channel.reveal;
  if (!reveal) 
    return <></>;
  const byId = new Map(channel.players.map((player) => [player.id, player]));
  const mine = reveal.results.find((result) => result.userId === channel.youId);
  /* Panel colour means "did I get it right?" (green, red, or plain if time ran out). Whether the statement was true or a myth is shown in words so
 correctly spotting a myth is never painted red. */
  const outcome: 'right' | 'wrong' | 'none' = mine && mine.correct !== null ? (mine.correct ? 'right' : 'wrong') : 'none';
  const FRAME = {
    right: 'border-correct bg-correct-wash',
    wrong: 'border-wrong bg-wrong-wash',
    none: 'border-rule-strong bg-surface',
  } as const;
  const HEADLINE = {
    right: { key: 'match.correct', tone: 'text-correct' },
    wrong: { key: 'match.wrong', tone: 'text-wrong' },
    none: { key: 'match.noAnswer', tone: 'text-muted' },
  } as const;
  const headline = HEADLINE[outcome];
  return (
    <div className="animate-reveal space-y-4">
      <div className={['stamp rounded border-2 px-5 py-4 text-center', FRAME[outcome]].join(' ')}>
        {/* Outcome first, since that's what the player is waiting for. Spectators have no result so they get a neutral frame.*/}
        {mine && (
          <p className={`text-2xl font-semibold ${headline.tone}`}>
            {t(headline.key)}
            {mine.points !== 0 && (
              <span className="ml-2 text-xl tabular-nums">
                {mine.points > 0 ? '+' : ''}
                {mine.points}
              </span>
            )}
          </p>
        )}

        <p
          className={[
            mine ? 'mt-1.5 text-sm' : 'text-xl',
            'font-semibold uppercase tracking-[0.08em]',
            reveal.isTrue ? 'text-truth' : 'text-myth',
          ].join(' ')}
        >
          {reveal.isTrue ? t('match.itWasTrue') : t('match.itWasFalse')}
        </p>

        {reveal.correction && (
          <p className="mx-auto mt-3 max-w-xl border-t border-current/20 pt-3 text-base leading-snug text-ink sm:text-lg">
            <span className="mr-1.5 font-sans text-xs font-medium text-muted">
              {t('match.inFact')}
            </span>
            {reveal.correction}
          </p>
        )}

        {reveal.sourceRef && (
          <p className="mt-2 text-[11px] text-muted">
            {t('match.sourceRef', { ref: reveal.sourceRef })}
          </p>
        )}
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {reveal.results.map((result) => {
          const player = byId.get(result.userId);
          return (
            <li
              key={result.userId}
              className={[
                'flex items-center gap-2.5 rounded-xl border px-3 py-2',
                result.correct === null
                  ? 'border-rule bg-surface'
                  : result.correct
                    ? 'border-correct/40 bg-correct-wash'
                    : 'border-wrong/40 bg-wrong-wash',
              ].join(' ')}
            >
              <Avatar name={player?.displayName ?? '?'} src={player?.avatarUrl ?? null} size={26} />
              <span className="min-w-0 flex-1 truncate text-sm text-ink">
                {player?.displayName ?? '—'}
              </span>
              <span className="text-xs text-muted">
                {result.correct === null
                  ? t('match.noAnswer')
                  : `${t(result.correct ? 'match.correct' : 'match.wrong')}${
                      result.reactionMs !== null ? ` · ${(result.reactionMs / 1000).toFixed(1)}s` : ''
                    }`}
              </span>
              <span
                className={[
                  'w-12 text-right text-sm font-semibold tabular-nums',
                  result.points > 0 ? 'text-correct' : result.points < 0 ? 'text-wrong' : 'text-muted',
                ].join(' ')}
              >
                {result.points > 0 ? '+' : ''}
                {result.points}
              </span>
            </li>
          );
        })}
      </ul>

      {!reveal.isLast && (
        <p className="text-center text-xs text-muted">
          {t('match.nextIn', { seconds: Math.round(reveal.nextInMs / 1000) })}
        </p>
      )}
    </div>
  );
}

// After the last card
function FinalScoreboard({ channel }: { channel: RoomChannel }): JSX.Element {
    const { t } = useTranslation();
  const { user, patchUser } = useAuth();
  const ended = channel.ended;
  const endedMatchId = ended?.matchId ?? null;
  useEffect(() => {
    if (endedMatchId === null) 
      return undefined;
    let cancelled = false;
    void api
      .get<{ user: SessionUser }>('/api/auth/me')
      .then(({ user: fresh }) => {
        if (!cancelled) 
          patchUser(fresh);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [endedMatchId, patchUser]);
  if (!ended) 
    return <></>;
  const top = ended.scoreboard[0];
  const tied = ended.scoreboard.filter((entry) => entry.rank === 1).length > 1;
  const myAward = ended.awards.find((award) => award.userId === channel.youId);
  const advanced = ended.tournament?.advancedUserId === channel.youId;
  return (
    <div className="mx-auto max-w-2xl animate-fade-up space-y-6">
      <div className="text-center">
        <p className="text-sm text-muted">{t('match.finalScoreboard')}</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">
          {tied || !top ? t('match.tie') : t('match.winner', { name: top.displayName })}
        </h1>
      </div>

      <Scoreboard entries={ended.scoreboard} youId={channel.youId} />

      {myAward && (
        <div className="panel-pad space-y-3 text-center">
          <p className="text-2xl font-semibold text-spot">
            {t('match.xpGained', { value: myAward.xpGained })}
          </p>
          {myAward.levelAfter > myAward.levelBefore && (
            <p className="text-sm text-correct">{t('match.levelUp', { level: myAward.levelAfter })}</p>
          )}
          {myAward.achievements.length > 0 && (
            <div>
              <p className="mb-2 text-xs text-muted">
                {t('match.achievementUnlocked')}
              </p>
              <ul className="flex flex-wrap justify-center gap-2">
                {myAward.achievements.map((achievement, index) => (
                  <li
                    key={achievement.slug}
                    className="animate-fade-up rounded-xl border border-spot/35 bg-spot-wash px-3 py-2 text-left"
                    style={{ animationDelay: `${180 + index * 60}ms` }}
                  >
                    <p className="text-sm font-medium text-spot-strong">
                      {t(`achievements.${achievement.slug}.name`, { defaultValue: achievement.name })}
                    </p>
                    <p className="text-xs text-muted">
                      {t(`achievements.${achievement.slug}.description`, {
                        defaultValue: achievement.description,
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {user && (
            <p className="text-xs text-muted">
              {t('profile.toNextLevel', {
                into: user.xpIntoLevel,
                needed: user.xpForNextLevel,
                level: user.level + 1,
              })}
            </p>
          )}
        </div>
      )}

      {ended.tournament && (
        <Alert tone={advanced ? 'success' : 'info'}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{advanced ? t('match.advanced') : t('match.eliminated')}</span>
            <Link
              to={`/tournaments/${ended.tournament.id}`}
              className="text-xs font-medium underline"
            >
              {t('tournament.bracket')}
            </Link>
          </div>
        </Alert>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="secondary" onClick={channel.dismissEnd}>
          {t('match.playAgain')}
        </Button>
        <Link
          to="/play"
          onClick={channel.leave}
          className="rounded-xl border border-rule-strong px-4 py-2.5 text-sm text-ink-soft transition hover:bg-surface-2"
        >
          {t('room.leave')}
        </Link>
      </div>
    </div>
  );
}
