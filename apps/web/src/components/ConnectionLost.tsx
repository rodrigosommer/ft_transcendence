import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

// Banner shown while the room socket is disconnected. Non blocking, since reconnects are quick 

export function ConnectionLost({ away }: { away: boolean }): JSX.Element | null {
  //Short grace period so a brief disconnect doesn't flash the banner
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!away) 
    {
      setVisible(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setVisible(true), 1200);
    return () => window.clearTimeout(timer);
  }, [away]);
  const { t } = useTranslation();
  if (!visible) 
    return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <div className="animate-fade-up pointer-events-auto flex max-w-md items-center gap-4 rounded-lg border border-rule-strong bg-surface px-4 py-3 shadow-[0_14px_30px_-16px_rgb(var(--shadow)/0.5)]">
        {/* A card that has left the deck and not arrived, with the gap between them pulsing while the socket retries. */}
        <span aria-hidden="true" className="relative hidden h-11 w-20 shrink-0 sm:block">
          <span
            className="absolute left-0 top-0 h-11 w-8 rounded border border-card-edge"
            style={{ background: 'rgb(var(--deck-near))' }}
          />
          <span className="card-face absolute right-0 top-0 h-11 w-8 rotate-[9deg]" />
          <span className="retrying absolute left-[38px] top-[19px] flex gap-1">
            <span className="h-1 w-1 rounded-full bg-rule-strong" />
            <span className="h-1 w-1 rounded-full bg-rule-strong" />
          </span>
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{t('room.lineDropped')}</p>
          <p className="mt-0.5 text-xs leading-snug text-muted">{t('room.lineDroppedBody')}</p>
        </div>
      </div>
    </div>
  );
}
