import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportSourcesPage } from '@/pages/ImportSourcesPage';
import { importSourceService } from '@/services/importSourceService';
import { analysisService } from '@/services/analysisService';

vi.mock('@/services/importSourceService', async () => {
  const actual = await vi.importActual<typeof import('@/services/importSourceService')>(
    '@/services/importSourceService',
  );
  return {
    ...actual,
    importSourceService: {
      getAll: vi.fn(),
      setDefault: vi.fn(),
      delete: vi.fn(),
    },
  };
});

vi.mock('@/services/analysisService', () => ({
  analysisService: { analyzeStoredTransactions: vi.fn() },
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ImportSourcesPage />
      </BrowserRouter>
    </QueryClientProvider>,
  );
}

describe('ImportSourcesPage', () => {
  beforeEach(() => {
    vi.mocked(importSourceService.setDefault).mockResolvedValue();
    vi.mocked(importSourceService.delete).mockResolvedValue();
    vi.mocked(analysisService.analyzeStoredTransactions).mockResolvedValue({} as never);
    vi.mocked(importSourceService.getAll).mockResolvedValue([
      {
        id: 'csv-1',
        type: 'CSV',
        displayName: 'transacoes-julho.csv',
        provider: null,
        status: 'COMPLETED',
        transactionCount: 10000,
        categorizedCount: 9998,
        sizeBytes: 1048576,
        createdAt: '2026-07-16T12:00:00Z',
        lastSyncAt: '2026-07-16T12:01:00Z',
        errorMessage: null,
        defaultSource: false,
      },
      {
        id: 'of-1',
        type: 'OPEN_FINANCE',
        displayName: 'Conta Corrente Nubank',
        provider: 'PLUGGY',
        status: 'CONNECTED',
        transactionCount: 230,
        categorizedCount: 230,
        sizeBytes: null,
        createdAt: '2026-07-15T12:00:00Z',
        lastSyncAt: '2026-07-16T13:00:00Z',
        errorMessage: null,
        defaultSource: true,
      },
    ]);
  });

  it('exibe arquivos, contas e o total de transações indexadas', async () => {
    renderPage();

    expect((await screen.findAllByText('transacoes-julho.csv')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Conta Corrente Nubank').length).toBeGreaterThan(0);
    expect(screen.getByText('10.230')).toBeInTheDocument();
  });

  it('filtra somente os arquivos CSV', async () => {
    renderPage();
    await screen.findAllByText('Conta Corrente Nubank');

    await userEvent.click(screen.getByRole('tab', { name: 'Arquivos CSV' }));

    expect(screen.getAllByText('transacoes-julho.csv').length).toBeGreaterThan(0);
    expect(screen.queryByText('Conta Corrente Nubank')).not.toBeInTheDocument();
  });

  it('define um arquivo como fonte padrão do dashboard', async () => {
    renderPage();
    await screen.findAllByText('transacoes-julho.csv');

    await userEvent.click(screen.getByRole('button', { name: 'Definir padrão' }));

    await waitFor(() => expect(importSourceService.setDefault).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'csv-1' }),
    ));
    expect(analysisService.analyzeStoredTransactions).toHaveBeenCalledWith(
      'MACHINE_LEARNING', 'CSV_IMPORT', undefined, 'csv-1',
    );
  });

  it('exige confirmação antes de excluir a fonte', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    await screen.findAllByText('transacoes-julho.csv');

    await userEvent.click(screen.getAllByRole('button', { name: 'Excluir transacoes-julho.csv' })[0]);

    await waitFor(() => expect(importSourceService.delete).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'csv-1' }),
    ));
    expect(confirm).toHaveBeenCalled();
  });
});
