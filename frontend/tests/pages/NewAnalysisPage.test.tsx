import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getImportSources: vi.fn(),
  getTransactions: vi.fn(),
  getSummary: vi.fn(),
  analyzeStoredTransactions: vi.fn(),
}));

vi.mock('@/services/importSourceService', () => ({
  importSourceService: { getAll: mocks.getImportSources },
}));

vi.mock('@/services/transactionService', () => ({
  transactionService: {
    getAll: mocks.getTransactions,
    getSummary: mocks.getSummary,
  },
}));

vi.mock('@/services/analysisService', () => ({
  analysisService: {
    analyzeStoredTransactions: mocks.analyzeStoredTransactions,
  },
}));

import { NewAnalysisPage } from '@/pages/NewAnalysisPage';

describe('NewAnalysisPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.getImportSources.mockResolvedValue([
      {
        id: 'fonte-123',
        type: 'CSV',
        displayName: 'dataset.csv',
        defaultSource: true,
      },
    ]);
    mocks.getTransactions.mockResolvedValue({ totalElements: 10, content: [] });
    mocks.getSummary.mockResolvedValue({
      totalIncome: 5000,
      totalExpense: 2000,
      balance: 3000,
    });
    mocks.analyzeStoredTransactions.mockResolvedValue({ id: 'analise-123' });
  });

  it('preserva a fonte selecionada pelo dashboard ao gerar o perfil', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={['/analyses/new?source=CSV_IMPORT&importSourceId=fonte-123']}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <NewAnalysisPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('10')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /analisar com machine learning/i }));

    await waitFor(() => {
      expect(mocks.analyzeStoredTransactions).toHaveBeenCalledWith(
        'MACHINE_LEARNING',
        'CSV_IMPORT',
        { startDate: undefined, endDate: undefined },
        'fonte-123',
      );
    });
  });
});
