import { useTranslation } from 'react-i18next';
import { useTheme, type Theme } from '../theme/ThemeContext.js';

const ORDER: Theme[] = ['light', 'system', 'dark'];

const ICONS: Record<Theme, JSX.Element> = {
  light: (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2v2.4M12 19.6V22M22 12h-2.4M4.4 12H2M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7M19.1 19.1l-1.7-1.7M6.6 6.6 4.9 4.9" strokeLinecap="round" />
    </svg>
  ),
  system: (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2.5" y="4" width="19" height="13" rx="2" />
      <path d="M8.5 20.5h7" strokeLinecap="round" />
    </svg>
  ),
  dark: (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20 13.4A8.4 8.4 0 1 1 10.6 4a6.6 6.6 0 0 0 9.4 9.4z" strokeLinejoin="round" />
    </svg>
  ),
};

// Light, follow the system, or dark
export function ThemeSwitcher(): JSX.Element {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  return (
    <div
      className="flex rounded-lg border border-rule-strong bg-surface p-0.5"
      role="group"
      aria-label={t('theme.label')}
    >
      {ORDER.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setTheme(option)}
          aria-pressed={theme === option}
          title={t(`theme.${option}`)}
          className={[
            // py-1.5 instead of py-1 with a 14px icon; py-1 gives only a 22px tap target which too small for a button in every header
            'press rounded px-1.5 py-1.5 sm:px-2',
            theme === option ? 'bg-spot text-surface' : 'text-muted hover:text-ink',
          ].join(' ')}
        >
          {ICONS[option]}
          <span className="sr-only">{t(`theme.${option}`)}</span>
        </button>
      ))}
    </div>
  );
}
