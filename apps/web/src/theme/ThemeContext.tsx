import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { applyTheme, readTheme, storeTheme, type Theme } from './useTheme.js';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (next: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/*The chosen theme is shared by the header switcher and the setup screen so they never disagree. 
Saved per device, not per account, because the right theme depends on the screen you're using.*/
export function ThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  const [theme, setStored] = useState<Theme>(readTheme);

  useEffect(() => {
    applyTheme(theme);
    storeTheme(theme);
  }, [theme]);

  // Following the system means following it when it changes, not only at boot.
  useEffect(() => {
    if (theme !== 'system') 
      return undefined;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => applyTheme('system');
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme: (next: Theme) => setStored(next) }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) 
    throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}

export type { Theme };
