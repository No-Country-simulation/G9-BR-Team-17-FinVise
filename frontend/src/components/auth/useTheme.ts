import { useContext } from 'react';
import { ThemeContext } from './theme-context';

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context) {
    return context;
  }

  return {
    theme: 'light' as const,
    resolvedTheme: 'light' as const,
    setTheme: () => undefined,
  };
}
