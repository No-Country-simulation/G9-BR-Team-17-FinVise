import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProfilePage } from '@/pages/ProfilePage';
import { analysisService } from '@/services/analysisService';

describe('ProfilePage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('oferece importação por CSV e por Open Finance quando não há análise', async () => {
    vi.spyOn(analysisService, 'getLatest').mockResolvedValue(null);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ProfilePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const csvOption = await screen.findByRole('link', { name: /importar arquivo csv/i });
    const openFinanceOption = screen.getByRole('link', { name: /conectar open finance/i });

    expect(csvOption).toHaveAttribute('href', '/import');
    expect(openFinanceOption).toHaveAttribute('href', '/open-finance');
  });
});
