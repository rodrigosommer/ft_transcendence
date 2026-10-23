import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CARD_MOTION } from '../theme/cardStyle.js';
import { suitFor, suitVars } from '../theme/suits.js';

/*A dead end, shown as a card, a statement the player believed, with a plum Myth verdict. 
Plum matches false statements elsewhere, not the red of a wrong answer, because the player did nothing wrong.*/
export function DeadEnd({
  statement,
  body,
  to,
  action,
  suit = 'culture',
}: {
  statement: string;
  body: string;
  to: string;
  action: string;
  suit?: string;
}): JSX.Element {
  const { t } = useTranslation();
  const art = suitFor(suit);
  return (
    <div
      className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-5 py-8"
      style={suitVars(suit)}
    >
      <article
        className={`card-face flex min-h-[13rem] w-full items-center px-6 py-10 ${CARD_MOTION ? 'deal-in' : ''}`}
      >
        <span aria-hidden="true" className="card-band" />
        <span aria-hidden="true" className="card-keyline" />
        <div className="relative flex w-full flex-col items-center">
          <span aria-hidden="true" className="mb-3" style={{ color: 'rgb(var(--cat))' }}>
            {art.crest(34)}
          </span>
          <p
            className="text-balance text-center text-2xl font-semibold leading-[1.15] tracking-[-0.02em] sm:text-3xl"
            style={{ color: 'rgb(var(--card-ink))' }}
          >
            {statement}
          </p>
        </div>
      </article>

      {/* The reveal panel, in the shape a player has already seen twenty times a match, the verdict, 
      then what is actually the case. */}
      <div className="stamp w-full rounded border-2 border-myth bg-myth-wash px-5 py-4 text-center">
        <p className="text-2xl font-semibold uppercase tracking-[0.08em] text-myth">
          {t('match.myth')}
        </p>
        <p className="mx-auto mt-2 max-w-[42ch] text-sm leading-relaxed text-ink">{body}</p>
      </div>
      <Link
        to={to}
        className="press rounded-lg border border-spot bg-spot px-4 py-2.5 text-sm font-medium text-surface"
      >
        {action}
      </Link>
    </div>
  );
}
