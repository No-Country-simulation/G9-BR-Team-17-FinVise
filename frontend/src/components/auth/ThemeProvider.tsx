import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ThemeContext, type ResolvedTheme, type ThemeMode } from './theme-context';

const themeStorageKey = 'finvise-theme';

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme());

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(themeStorageKey);
    if (savedTheme === 'dark' || savedTheme === 'light' || savedTheme === 'system') {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => setSystemTheme(mediaQuery.matches ? 'dark' : 'light');

    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    root.classList.toggle('dark', resolvedTheme === 'dark');
    root.dataset.theme = resolvedTheme;
    body.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
    body.style.colorScheme = resolvedTheme;
    window.localStorage.setItem(themeStorageKey, theme);
  }, [resolvedTheme, theme]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [resolvedTheme, theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
