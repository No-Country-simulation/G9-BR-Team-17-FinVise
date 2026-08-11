import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemeProvider } from '@/components/auth/ThemeProvider';
import { useTheme } from '@/components/auth/useTheme';

function ThemeProbe() {
  const { theme, resolvedTheme } = useTheme();

  return <output>{`${theme}:${resolvedTheme}`}</output>;
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    delete document.documentElement.dataset.theme;
    delete document.body.dataset.theme;
  });

  it('inicia no tema claro quando não existe preferência salva', async () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(screen.getByText('light:light')).toBeInTheDocument();

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('data-theme', 'light');
      expect(window.localStorage.getItem('finvise-theme')).toBe('light');
    });
  });

  it('mantém o tema escuro quando ele foi escolhido anteriormente', async () => {
    window.localStorage.setItem('finvise-theme', 'dark');

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(screen.getByText('dark:dark')).toBeInTheDocument();

    await waitFor(() => {
      expect(document.documentElement).toHaveClass('dark');
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    });
  });
});
