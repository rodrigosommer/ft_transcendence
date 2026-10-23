import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ScoreboardEntry, ServedCard, Vote } from '@wkb/shared';
import { Avatar } from './ui.js';
import { CARD_MOTION, CARD_SUITS, DECK_OFFSETS } from '../theme/cardStyle.js';
import { suitFor, suitVars } from '../theme/suits.js';

//Decorative countdown bar timed from the local paint not 'deadline_at'. The server owns the deadline.
export function TimerBar({
  startedAt,
  windowMs,
  paused = false,
}: {
  startedAt: number;
  windowMs: number;
  paused?: boolean;
}): JSX.Element {
  const [remaining, setRemaining] = useState(() => Math.max(0, windowMs - (Date.now() - startedAt)));
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (paused) 
      return undefined;
    const tick = () => {
      setRemaining(Math.max(0, windowMs - (Date.now() - startedAt)));
      frameRef.current = window.requestAnimationFrame(tick);
    };
    frameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) 
        window.cancelAnimationFrame(frameRef.current);
    };
  }, [startedAt, windowMs, paused]);
  const ratio = windowMs > 0 ? remaining / windowMs : 0;
  const seconds = Math.ceil(remaining / 1000);
  //Solid steps (ink, ochre, red), not a gradient because the colour carries meaning
  const tone = ratio > 0.5 ? 'bg-ink-soft' : ratio > 0.22 ? 'bg-spot' : 'bg-wrong';
  const textTone = ratio > 0.5 ? 'text-ink-soft' : ratio > 0.22 ? 'text-spot' : 'text-wrong';
  return (
    <div className="flex items-center gap-3">
      <div className="h-[3px] flex-1 overflow-hidden bg-surface-2" role="presentation">
        {/* scaleX, not width: this runs every frame for the whole answer window, and width costs a layout 
        and a paint each time where a transform is composited. */}
        <div
          className={`h-full w-full origin-left ${tone} ${CARD_MOTION && remaining <= 3000 && remaining > 0 ? 'urgency' : ''}`}
          style={{ transform: `scaleX(${ratio})` }}
        />
      </div>
      <span className={`data w-8 text-right text-lg font-semibold ${textTone}`} aria-live="off">
        {seconds}
      </span>
    </div>
  );
}

export function CardFace({
  card,
  dimmed = false,
}: {
  card: ServedCard;
  dimmed?: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  const suit = suitFor(card.categorySlug);
  // Sheets behind the card show the rest of the deck, so each new card comes off a stack. None on the last card
  const remaining = card.total - card.position;
  const sheets = CARD_SUITS ? DECK_OFFSETS.slice(0, Math.max(0, Math.min(2, remaining))) : [];
  const index = String(card.position).padStart(2, '0');
  return (
    <div
      /* The sheets stick out below and to the right; the wrapper reserves that space rather than letting them
      fall outside the layout. */
      className="relative pb-5 pr-6"
      style={CARD_SUITS ? suitVars(card.categorySlug) : undefined}
    >
      {/* Painted furthest first so the nearest sheet sits on top of the rest */}
      {[...sheets].reverse().map((offset) => (
        <div
          key={offset.dx}
          aria-hidden="true"
          className={`deck-sheet ${CARD_MOTION ? 'deck-settle' : ''}`}
          style={
            {
              background: offset.dx > 10 ? 'rgb(var(--deck-far))' : 'rgb(var(--deck-near))',
              transform: `translate(${offset.dx}px, ${offset.dy}px)`,
              '--dx': `${offset.dx}px`,
              '--dy': `${offset.dy}px`,
            } as React.CSSProperties
          }
        />
      ))}

      <article
        className={[
          /* A minimum height so a four word statement still produces a card rather than a strip. 
          The deck behind it is the same shape. */
          'card-face flex min-h-[21rem] items-center px-6 py-12 sm:min-h-[25rem] sm:px-12',
          CARD_MOTION ? 'deal-in' : '',
          dimmed ? 'opacity-70' : '',
        ].join(' ')}
      >
        {CARD_SUITS && (
          <>
            <span aria-hidden="true" className="card-band" />
            <span aria-hidden="true" className="card-keyline" />
            <span
              aria-hidden="true"
              className="absolute left-5 top-5 flex flex-col items-center gap-0.5 text-[11px] font-bold tracking-[0.08em] sm:left-7 sm:top-7"
              style={{ color: 'rgb(var(--cat))' }}
            >
              {index}
              {suit.pip(13)}
            </span>
            <span
              aria-hidden="true"
              className="absolute bottom-5 right-5 flex flex-col items-center gap-0.5 text-[11px] font-bold tracking-[0.08em] sm:bottom-7 sm:right-7"
              style={{ color: 'rgb(var(--cat))' }}
            >
              {index}
              {suit.pip(13)}
            </span>
          </>
        )}

        <div className="relative flex w-full flex-col items-center">
          {CARD_SUITS && (
            <span aria-hidden="true" className="mb-3" style={{ color: 'rgb(var(--cat))' }}>
              {suit.crest(42)}
            </span>
          )}

          <header
            className="mb-5 flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: CARD_SUITS ? 'rgb(var(--cat))' : undefined }}
          >
            <span>{t(`categories.${card.categorySlug}`, { defaultValue: card.categoryName })}</span>
            <span aria-hidden="true">·</span>
            <span>{t(`difficulty.${card.difficulty}`)}</span>
            {card.isDouble && (
              <>
                <span aria-hidden="true">·</span>
                <span>{t('match.doubleCard')}</span>
              </>
            )}
          </header>

          <p
            className="mx-auto max-w-3xl text-balance text-center text-3xl font-semibold leading-[1.13] tracking-[-0.025em] sm:text-[2.9rem]"
            style={{ color: 'rgb(var(--card-ink))' }}
          >
            {card.text}
          </p>

          {card.fallbackLocale && (
            <p className="mt-5 text-center text-xs" style={{ color: 'rgb(var(--card-dim))' }}>
              {t('match.translationFallback', { locale: card.fallbackLocale })}
            </p>
          )}
        </div>
      </article>
    </div>
  );
}

export function VoteButtons({
  onVote,
  chosen,
  disabled,
}: {
  onVote: (choice: Vote) => void;
  chosen: Vote | null;
  disabled: boolean;
}): JSX.Element {
  const { t } = useTranslation();

  // Keyboard shortcuts, a quiz played against a clock should not require aim
  useEffect(() => {
    if (disabled)
      return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey)
        return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName))
        return;
      if (event.key === '1' || event.key.toLowerCase() === 't') onVote('truth');
      if (event.key === '2' || event.key.toLowerCase() === 'm') onVote('myth');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onVote, disabled]);

  const base =
    'press flex-1 rounded border px-6 py-5 text-left transition disabled:cursor-not-allowed sm:py-6';

  /*Written out rather than interpolated: Tailwind compiles the classes it can literally see in the source 
  so 'bg-${colour}' would produce no CSS at all.*/
  const SKIN = {
    truth: {
      idle: 'border-truth/40 bg-surface hover:bg-truth-wash',
      active: 'border-truth bg-truth text-surface',
      word: 'text-truth',
    },
    myth: {
      idle: 'border-myth/40 bg-surface hover:bg-myth-wash',
      active: 'border-myth bg-myth text-surface',
      word: 'text-myth',
    },
  } as const;
  const face = (choice: Vote, key: string) => {
    const active = chosen === choice;
    const spent = chosen !== null && !active;
    const skin = SKIN[choice];
    return (
      <button
        key={choice}
        type="button"
        onClick={() => onVote(choice)}
        disabled={disabled}
        aria-pressed={active}
        aria-keyshortcuts={key}
        className={[
          base,
          active ? skin.active : spent ? 'border-rule bg-surface text-muted' : skin.idle,
        ].join(' ')}
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className={`text-xl font-semibold sm:text-2xl ${active || spent ? '' : skin.word}`}>
            {t(`match.${choice}`)}
          </span>
          <span className={`data text-xs ${active ? 'opacity-70' : 'text-muted'}`} aria-hidden="true">
            {key}
          </span>
        </span>
      </button>
    );
  };
  return <div className="flex flex-col gap-3 sm:flex-row">{face('truth', 'T')}{face('myth', 'M')}</div>;
}


/* The scoreboard, laid out like a ledger; rank, name, and score in tabular figures so numbers line up
Slides scoreboard rows to their new positions instead of letting them jump 
(FLIP: measure before paint, invert the difference, play it forward). 
Uses WAAPI, not a CSS class, so a second reveal mid-slide replaces the motion instead of queueing behind it */
function useRankFlip(entries: ScoreboardEntry[]): (id: number) => (node: HTMLLIElement | null) => void {
  const rows = useRef(new Map<number, HTMLLIElement>());
  const previousTops = useRef(new Map<number, number>());
  useLayoutEffect(() => {
    const before = previousTops.current;
    const after = new Map<number, number>();
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const [id, node] of rows.current) 
    {
      const applied = getComputedStyle(node).transform;
      const inflight = applied && applied !== 'none' ? new DOMMatrixReadOnly(applied).m42 : 0;
      for (const running of node.getAnimations()) 
        running.cancel();
      const top = node.offsetTop;
      after.set(id, top);
      const was = before.get(id);
      // A row that was not on screen last time has nowhere to travel from.
      if (still || was === undefined) 
        continue;
      // Start from where the row actually is so a second reorder landing mid slide continues rather than jumping back to the old layout.
      const from = was - top + inflight;
      if (from === 0) 
        continue;
      node.animate(
        [{ transform: `translateY(${from}px)` }, { transform: 'translateY(0)' }],
        { duration: 180, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
      );
    }
    previousTops.current = after;
  }, [entries]);
  return (id: number) => (node: HTMLLIElement | null) => {
    if (node) 
      rows.current.set(id, node);
    else 
      rows.current.delete(id);
  };
}

export function Scoreboard({
  entries,
  youId,
  compact = false,
}: {
  entries: ScoreboardEntry[];
  youId: number | null;
  compact?: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  const rowRef = useRankFlip(entries);
  return (
    <section className="panel overflow-hidden">
      <h2 className="border-b border-rule px-4 py-2.5 text-sm font-semibold text-ink">
        {t('scoreboard.title')}
      </h2>
      {entries.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted">{t('match.waiting')}</p>
      ) : (
        <ol className="divide-y divide-rule">
          {entries.map((entry) => {
            const isYou = entry.userId === youId;
            return (
              <li
                key={entry.userId}
                ref={CARD_MOTION ? rowRef(entry.userId) : undefined}
                className={[
                  'flex items-center gap-3 px-4 py-2.5',
                  isYou ? 'bg-spot-wash' : '',
                  entry.connected ? '' : 'opacity-55',
                ].join(' ')}
              >
                <span className="data w-4 text-right text-sm text-muted">{entry.rank}</span>
                <Avatar name={entry.displayName} src={entry.avatarUrl} size={compact ? 24 : 28} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">
                    {entry.displayName}
                    {entry.isBot && (
                      <span className="ml-2 rounded border border-rule px-1 text-[10px] text-muted">
                        {t('common.bot')}
                      </span>
                    )}
                  </p>
                  {entry.comboCurrent > 1 && (
                    <p className="text-[11px] text-spot-strong">
                      {t('match.combo', { value: entry.comboCurrent })}
                    </p>
                  )}
                  {!entry.connected && <p className="text-[11px] text-muted">{t('common.offline')}</p>}
                </div>

                <div className="text-right">
                  <p className="data text-sm font-semibold text-ink">{entry.score}</p>
                  {entry.lastDelta !== null && entry.lastDelta !== 0 && (
                    <p
                      key={`${entry.userId}:${entry.score}`}
                      className={[
                        'data text-[11px]',
                        CARD_MOTION ? 'tick-up' : '',
                        entry.lastDelta > 0 ? 'text-correct' : 'text-wrong',
                      ].join(' ')}
                    >
                      {entry.lastDelta > 0 ? '+' : ''}
                      {entry.lastDelta}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
