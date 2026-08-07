import { useContext } from 'react';
import { ThemeContext } from './theme-context';

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context) {
    return context;
  }

  return {
    theme: 'dark' as const,
    resolvedTheme: 'dark' as const,
    setTheme: () => undefined,
  };
}
