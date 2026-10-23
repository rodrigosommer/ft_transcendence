import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@wkb/shared';
import { emitLocaleChange } from './localeBus.js';
import en from './locales/en.json';
import ptBR from './locales/pt-BR.json';
import fr from './locales/fr.json';

const STORAGE_KEY = 'wkb.locale';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/* Language order, ie, the user's last choice, then the browser's, then English.
 A signed-in account's saved language overrides all of these (see 'AuthContext'). */
function initialLocale(): Locale {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) 
      return saved;
  } catch {
    // Private mode or blocked storage; fall through to the browser's choice
  }

  for (const candidate of navigator.languages ?? []) 
  {
    if (isLocale(candidate)) 
      return candidate;
    const base = candidate.split('-')[0];
    const match = LOCALES.find((locale) => locale.split('-')[0] === base);
    if (match) 
      return match;
  }
  return DEFAULT_LOCALE;
}

void i18next.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    'pt-BR': { translation: ptBR },
    fr: { translation: fr },
  },
  lng: initialLocale(),
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: [...LOCALES],
  interpolation: { escapeValue: false },
  returnNull: false,
});

export function setLocale(locale: Locale): void {
  void i18next.changeLanguage(locale);
  document.documentElement.lang = locale;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Preference simply will not persist; the app still works.
  }
  emitLocaleChange(locale);
}

export function currentLocale(): Locale {
  return isLocale(i18next.language) ? i18next.language : DEFAULT_LOCALE;
}

document.documentElement.lang = currentLocale();

export default i18next;
