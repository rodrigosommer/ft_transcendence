import type { Locale } from '@wkb/shared';

//A tiny pub/sub for language changes, so the header switcher and the room socket (which don't contain each other) can communicate without a shared context.
type Listener = (locale: Locale) => void;

const listeners = new Set<Listener>();

export function onLocaleChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitLocaleChange(locale: Locale): void {
  for (const listener of listeners) 
    listener(locale);
}
