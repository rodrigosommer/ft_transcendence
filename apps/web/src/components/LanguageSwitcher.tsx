import { useTranslation } from 'react-i18next';
import { LOCALE_LABELS, LOCALES, type Locale } from '@wkb/shared';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.js';
import { currentLocale, setLocale } from '../i18n/index.js';

/* Language changes apply immediately and, for signed-in players, are saved on the account, which sets the language of their cards.
Each player sees the card in their own language, since the answer is the same. */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }): JSX.Element {
  const { t } = useTranslation();
  const { user, patchUser } = useAuth();
  const active = currentLocale();
  const change = (locale: Locale) => {
    if (locale === active) 
      return;
    setLocale(locale);
    if (user) 
    {
      patchUser({ locale });
      void api.patch('/api/users/me', { locale }).catch(() => undefined);
    }
  };
  return (
    <div className={compact ? '' : 'flex items-center gap-2'}>
      {!compact && <span className="text-xs text-muted">{t('common.language')}</span>}
      <div className="flex rounded-lg border border-rule-strong bg-surface p-0.5" role="group" aria-label={t('common.language')}>
        {LOCALES.map((locale) => (
          <button
            key={locale}
            type="button"
            onClick={() => change(locale)}
            aria-pressed={locale === active}
            title={LOCALE_LABELS[locale]}
            className={[
              'rounded-md px-2 py-1 text-xs font-medium uppercase transition',
              locale === active
                ? 'bg-spot text-surface'
                : 'text-muted hover:bg-surface-2 hover:text-ink',
            ].join(' ')}
          >
            {locale === 'pt-BR' ? 'PT' : locale.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
