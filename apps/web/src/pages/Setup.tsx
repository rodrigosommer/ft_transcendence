import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LOCALE_LABELS,
  LOCALES,
  displayNameSchema,
  presetFromStored,
  presetToStored,
  type AvatarPreset,
  type Locale,
} from '@wkb/shared';
import { ApiError, api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.js';
import { currentLocale, setLocale } from '../i18n/index.js';
import { useTheme, type Theme } from '../theme/ThemeContext.js';
import { Alert, Button, Field } from '../components/ui.js';
import { AvatarPicker } from '../components/AvatarPicker.js';

// A miniature of the room in a given theme in fixed colours. They ignore the current theme on purpose, since the preview has to show a theme you're not in
const ROOMS = {
  light: { paper: '#ece5d3', rule: '#d8cfb8', ink: '#1b1713', spot: '#8a5d14' },
  dark: { paper: '#16131c', rule: '#2c2637', ink: '#f4efe4', spot: '#e0ad55' },
} as const;

function RoomPreview({ theme }: { theme: Theme }): JSX.Element {
  // "Follow the system" is genuinely both, so it is drawn as both
  const halves: Array<keyof typeof ROOMS> = theme === 'system' ? ['light', 'dark'] : [theme];
  return (
    <span
      aria-hidden="true"
      className="relative flex h-20 w-full overflow-hidden rounded border border-rule"
    >
      {halves.map((half) => (
        <span key={half} className="flex-1" style={{ background: ROOMS[half].paper }} />
      ))}

      {/* The card, always paper, exactly as it is in the game */}
      <span className="absolute inset-0 flex items-center justify-center">
        <span
          className="flex h-12 w-16 flex-col justify-center gap-1 rounded-sm px-2"
          style={{ background: '#faf5e9', border: '1px solid #cfc0a2' }}
        >
          <span className="block h-1 rounded-full" style={{ background: '#8a5d14' }} />
          <span className="block h-1 w-4/5 rounded-full" style={{ background: '#1b1713' }} />
          <span className="block h-1 w-3/5 rounded-full" style={{ background: '#5d5548' }} />
        </span>
      </span>
    </span>
  );
}

const THEMES: Theme[] = ['light', 'system', 'dark'];

export function Setup(): JSX.Element {
  const { t } = useTranslation();
  const { user, patchUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [avatar, setAvatar] = useState<AvatarPreset | null>(() => presetFromStored(user?.avatarUrl));
  const [locale, setChosenLocale] = useState<Locale>(currentLocale());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const chooseLocale = (next: Locale) => {
    setChosenLocale(next);
    setLocale(next);
  };
  const finish = async (withAnswers: boolean) => {
    setProblem(null);
    const body: {
      onboarded: true;
      displayName?: string;
      locale?: Locale;
      avatarPreset?: AvatarPreset | null;
    } = { onboarded: true };
    if (withAnswers) 
    {
      const parsed = displayNameSchema.safeParse(displayName);
      if (!parsed.success) 
      {
        setErrors({ displayName: parsed.error.issues[0]?.message ?? 'validation.displayName.length' });
        return;
      }
      setErrors({});
      if (parsed.data !== user?.displayName) 
        body.displayName = parsed.data;
      if (locale !== user?.locale) 
        body.locale = locale;
      if (avatar !== presetFromStored(user?.avatarUrl)) 
        body.avatarPreset = avatar;
    }
    setBusy(true);
    try {
      await api.patch('/api/users/me', body);
      patchUser({
        onboarded: true,
        ...(body.displayName ? { displayName: body.displayName } : {}),
        ...(body.locale ? { locale: body.locale } : {}),
        ...(body.avatarPreset !== undefined
          ? { avatarUrl: body.avatarPreset === null ? null : presetToStored(body.avatarPreset) }
          : {}),
      });
      navigate('/play', { replace: true });
    } catch (error) {
      if (error instanceof ApiError) 
      {
        setErrors(error.fields);
        setProblem(error.code);
      }
      else
        setProblem('error.internal');
      setBusy(false);
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void finish(true);
  };
  return (
    <div className="mx-auto max-w-2xl animate-fade-up">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-spot">
          {t('setup.eyebrow')}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {t('setup.title', { name: user?.displayName ?? '' })}
        </h1>
        <p className="mt-2 max-w-prose text-sm text-muted">{t('setup.lead')}</p>
      </header>

      <form onSubmit={submit} className="space-y-5" noValidate>
        {problem && <Alert tone="error">{t(problem, { defaultValue: t('error.internal') })}</Alert>}

        <section className="panel-pad">
          <h2 className="section-title">{t('setup.nameTitle')}</h2>
          <Field
            id="field-display-name"
            label={t('setup.nameLabel')}
            hint={t('setup.nameHint')}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            error={errors.displayName}
            autoComplete="nickname"
            maxLength={24}
          />
        </section>

        <section className="panel-pad">
          <h2 className="section-title">{t('setup.avatarTitle')}</h2>
          <p className="mb-4 text-sm text-muted">{t('setup.avatarHint')}</p>
          <AvatarPicker
            value={avatar === null ? null : presetToStored(avatar)}
            displayName={displayName || (user?.displayName ?? '')}
            onChange={setAvatar}
          />
        </section>

        <section className="panel-pad">
          <h2 className="section-title">{t('setup.languageTitle')}</h2>
          <p className="mb-3 text-sm text-muted">{t('setup.languageHint')}</p>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t('common.language')}>
            {LOCALES.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={option === locale}
                onClick={() => chooseLocale(option)}
                className={[
                  'press rounded-lg border px-3 py-2.5 text-left text-sm',
                  option === locale
                    ? 'border-spot bg-spot-wash font-medium text-ink'
                    : 'border-rule-strong bg-surface text-ink-soft',
                ].join(' ')}
              >
                <span className="block font-medium">{LOCALE_LABELS[option]}</span>
                <span className="data block text-[11px] uppercase text-muted">{option}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="panel-pad">
          <h2 className="section-title">{t('setup.themeTitle')}</h2>
          <p className="mb-3 text-sm text-muted">{t('setup.themeHint')}</p>
          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label={t('theme.label')}>
            {THEMES.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={option === theme}
                onClick={() => setTheme(option)}
                className={[
                  'press rounded-lg border p-2 text-left',
                  option === theme ? 'border-spot bg-spot-wash' : 'border-rule-strong bg-surface',
                ].join(' ')}
              >
                <RoomPreview theme={option} />
                <span
                  className={[
                    'mt-2 block px-1 pb-0.5 text-sm',
                    option === theme ? 'font-medium text-ink' : 'text-ink-soft',
                  ].join(' ')}
                >
                  {t(`theme.${option}`)}
                </span>
              </button>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={busy} disabled={busy}>
            {t('setup.submit')}
          </Button>
          <button
            type="button"
            onClick={() => void finish(false)}
            disabled={busy}
            className="press rounded-lg px-3 py-2 text-sm text-muted disabled:opacity-50"
          >
            {t('setup.skip')}
          </button>
        </div>
      </form>
    </div>
  );
}
