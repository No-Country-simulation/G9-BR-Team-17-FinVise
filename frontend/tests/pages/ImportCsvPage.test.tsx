import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  importCsv: vi.fn(),
  getRagIndexStatus: vi.fn(),
  getRagIndexQueueStatus: vi.fn(),
  analyzeStoredTransactions: vi.fn(),
}));

vi.mock('@/services/transactionService', () => ({
  transactionService: {
    importCsv: mocks.importCsv,
    getRagIndexStatus: mocks.getRagIndexStatus,
    getRagIndexQueueStatus: mocks.getRagIndexQueueStatus,
  },
}));

vi.mock('@/services/analysisService', () => ({
  analysisService: {
    analyzeStoredTransactions: mocks.analyzeStoredTransactions,
  },
}));

import { ImportCsvPage } from '@/pages/ImportCsvPage';

const renderPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ImportCsvPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('ImportCsvPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aceita um arquivo CSV dentro do limite', () => {
    const { container } = renderPage();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(
      ['description,amount,date,type\nMercado,100,2026-07-01,EXPENSE'],
      'transactions.csv',
      { type: 'text/csv' },
    );

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText('transactions.csv')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /importar/i })).toBeEnabled();
  });

  it('rejeita um arquivo maior que 5 MiB antes do envio', () => {
    const { container } = renderPage();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['header'], 'large.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 + 1 });

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText('O arquivo excede o tamanho máximo de 5 MB.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /importar/i })).toBeDisabled();
  });

  it('acompanha a indexação até concluir antes de gerar a análise', async () => {
    let completeIndexing!: (status: {
      status: string;
      totalDocuments: number;
      pendingDocuments: number;
      processingDocuments: number;
      indexedDocuments: number;
      failedDocuments: number;
    }) => void;
    const completedStatus = new Promise((resolve) => {
      completeIndexing = resolve;
    });
    mocks.importCsv.mockResolvedValue({
      sourceId: 'fonte-123',
      importedCount: 2,
      categorizedCount: 2,
    });
    mocks.analyzeStoredTransactions.mockResolvedValue({ id: 'analise-123' });
    mocks.getRagIndexStatus
      .mockResolvedValueOnce({
        status: 'PENDING',
        totalDocuments: 4,
        pendingDocuments: 2,
        processingDocuments: 0,
        indexedDocuments: 2,
        failedDocuments: 0,
      })
      .mockReturnValueOnce(completedStatus);

    const { container } = renderPage();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(
      ['description,amount,date,type\nMercado,100,2026-07-01,EXPENSE'],
      'transactions.csv',
      { type: 'text/csv' },
    );

    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /^importar e analisar$/i }));

    await waitFor(() => {
      expect(mocks.getRagIndexStatus).toHaveBeenCalledTimes(2);
    }, { timeout: 2500 });
    expect(mocks.analyzeStoredTransactions).not.toHaveBeenCalled();
    expect(screen.getByRole('progressbar', {
      name: /progresso da importação e indexação/i,
    })).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText(/2 de 4 documentos vetorizados; 2 restantes/i)).toBeInTheDocument();

    await act(async () => {
      completeIndexing({
        status: 'COMPLETE',
        totalDocuments: 4,
        pendingDocuments: 0,
        processingDocuments: 0,
        indexedDocuments: 4,
        failedDocuments: 0,
      });
    });

    await waitFor(() => {
      expect(mocks.analyzeStoredTransactions).toHaveBeenCalledOnce();
    });
    expect(mocks.getRagIndexStatus).toHaveBeenCalledTimes(2);
    expect(mocks.getRagIndexStatus).toHaveBeenCalledWith('fonte-123');
    expect(mocks.analyzeStoredTransactions).toHaveBeenCalledWith(
      'MACHINE_LEARNING',
      'CSV_IMPORT',
      undefined,
      'fonte-123',
    );
    expect(screen.getByText(/2 transações importadas, 2 categorizadas/i)).toBeInTheDocument();
    expect(screen.getByText(/indexação vetorial foi concluída/i)).toBeInTheDocument();
  });

  it('interrompe a análise quando a fila entra em dead-letter', async () => {
    mocks.importCsv.mockResolvedValue({
      sourceId: 'fonte-123',
      importedCount: 2,
      categorizedCount: 2,
    });
    mocks.getRagIndexStatus.mockResolvedValue({
      status: 'PENDING',
      totalDocuments: 4,
      pendingDocuments: 1,
      processingDocuments: 0,
      indexedDocuments: 2,
      failedDocuments: 1,
    });
    mocks.getRagIndexQueueStatus.mockResolvedValue({
      status: 'DEAD_LETTER',
      attempts: 5,
    });

    const { container } = renderPage();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(
      ['description,amount,date,type\nMercado,100,2026-07-01,EXPENSE'],
      'transactions.csv',
      { type: 'text/csv' },
    );

    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /^importar e analisar$/i }));

    expect(await screen.findByText(/falhou após esgotar as tentativas/i)).toBeInTheDocument();
    expect(mocks.analyzeStoredTransactions).not.toHaveBeenCalled();
  });
});
