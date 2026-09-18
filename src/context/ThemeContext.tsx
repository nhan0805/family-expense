import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

type ThemeState = {
  preference: ThemePreference;
  resolvedTheme: 'light' | 'dark';
  setPreference: (preference: ThemePreference) => void;
};

const STORAGE_KEY = 'family-expense-theme';
const ThemeContext = createContext<ThemeState | null>(null);

const readPreference = (): ThemePreference => {
  const value = window.localStorage.getItem(STORAGE_KEY);
  if (value === 'dark' || value === 'light' || value === 'system') return value;
  return 'system';
};

const readSystemTheme = (): 'light' | 'dark' => window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(readSystemTheme);
  const resolvedTheme = preference === 'system' ? systemTheme : preference;

  useEffect(() => {
    if (preference !== 'system') return undefined;
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return undefined;
    const handleChange = (event: MediaQueryListEvent) => setSystemTheme(event.matches ? 'dark' : 'light');
    setSystemTheme(media.matches ? 'dark' : 'light');
    media.addEventListener?.('change', handleChange);
    return () => media.removeEventListener?.('change', handleChange);
  }, [preference]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolvedTheme === 'dark');
    root.dataset.theme = resolvedTheme;
    const themeColor = resolvedTheme === 'dark' ? '#282a36' : '#1e40af';
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', themeColor);
  }, [resolvedTheme]);

  const setPreference = (value: ThemePreference) => {
    setPreferenceState(value);
    window.localStorage.setItem(STORAGE_KEY, value);
  };

  const value = useMemo(() => ({ preference, resolvedTheme, setPreference }), [preference, resolvedTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('ThemeProvider missing');
  return value;
}

export function useOptionalTheme(): ThemeState {
  return useContext(ThemeContext) ?? {
    preference: 'system',
    resolvedTheme: 'light',
    setPreference: () => undefined,
  };
}
