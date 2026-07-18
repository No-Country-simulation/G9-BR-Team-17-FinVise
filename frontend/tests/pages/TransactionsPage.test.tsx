import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionsPage } from '@/pages/TransactionsPage';
import { transactionService } from '@/services/transactionService';
import { importSourceService } from '@/services/importSourceService';

vi.mock('@/services/transactionService', () => ({
  transactionService: {
    getAll: vi.fn(),
  },
}));

vi.mock('@/services/importSourceService', () => ({
  importSourceService: { getAll: vi.fn() },
}));

const getAllMock = vi.mocked(transactionService.getAll);

const renderPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <TransactionsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('TransactionsPage', () => {
  beforeEach(() => {
    vi.mocked(importSourceService.getAll).mockResolvedValue([
      {
        id: 'open-finance-1',
        type: 'OPEN_FINANCE',
        displayName: 'Mastercard Black',
        provider: 'pluggy',
        status: 'CONNECTED',
        transactionCount: 16,
        categorizedCount: 16,
        sizeBytes: null,
        createdAt: '2026-07-16T12:00:00Z',
        lastSyncAt: '2026-07-16T12:01:00Z',
        errorMessage: null,
        defaultSource: true,
      },
    ]);
    getAllMock.mockReset();
    getAllMock.mockImplementation(async (filters) => {
      const page = filters?.page ?? 0;
      return {
        content: [
          {
            id: `transaction-${page}`,
            description: `Mercado página ${page + 1}`,
            amount: 150,
            date: '2026-07-15',
            type: 'EXPENSE',
            category: 'ALIMENTACAO',
          },
        ],
        totalElements: 60,
        totalPages: 3,
        size: filters?.size ?? 25,
        number: page,
      };
    });
  });

  it('envia página e tamanho para a API e navega para a próxima página', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Mercado página 1')).toBeInTheDocument();
    expect(getAllMock).toHaveBeenCalledWith(expect.objectContaining({ page: 0, size: 25 }));
    expect(screen.getByText('60 transações')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Próxima página' }));

    await waitFor(() => {
      expect(getAllMock).toHaveBeenCalledWith(expect.objectContaining({ page: 1, size: 25 }));
    });
    expect(await screen.findByText('Mercado página 2')).toBeInTheDocument();
  });

  it('reinicia na primeira página ao alterar um filtro', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Mercado página 1');

    await user.selectOptions(screen.getByLabelText('Filtrar por categoria'), 'SAUDE');

    await waitFor(() => {
      expect(getAllMock).toHaveBeenCalledWith(expect.objectContaining({
        page: 0,
        category: 'SAUDE',
      }));
    });
  });

  it('seleciona automaticamente uma fonte existente em vez da origem antiga do navegador', async () => {
    localStorage.setItem('finance_ai_transaction_source', 'CSV_IMPORT');
    renderPage();

    expect(await screen.findByText('Mercado página 1')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Fonte dos dados' })).toHaveValue('open-finance-1');
    expect(getAllMock).toHaveBeenCalledWith(expect.objectContaining({
      source: 'OPEN_FINANCE_PLUGGY',
      importSourceId: 'open-finance-1',
    }));
  });
});
