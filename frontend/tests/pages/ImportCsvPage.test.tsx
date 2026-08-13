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

    expect(screen.getByText(/large\.csv: excede 5 MB/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /importar .* gerar análise/i })).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: /importar 1 arquivo e gerar análise/i }));

    await waitFor(() => {
      expect(mocks.getRagIndexStatus).toHaveBeenCalledTimes(2);
    }, { timeout: 2500 });
    expect(mocks.analyzeStoredTransactions).not.toHaveBeenCalled();
    expect(screen.getByRole('progressbar', {
      name: /progresso da importação/i,
    })).toHaveAttribute('aria-valuenow', '55');
    expect(screen.getByText(/seu arquivo já foi recebido e será processado em seguida/i)).toBeInTheDocument();

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
      undefined,
      ['fonte-123'],
    );
    expect(screen.getByText(/1 arquivo, 2 transações importadas e 2 categorizadas/i)).toBeInTheDocument();
    expect(screen.getByText(/importação concluída/i)).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: /importar 1 arquivo e gerar análise/i }));

    expect(await screen.findByText(/não foi possível preparar todos os dados/i)).toBeInTheDocument();
    expect(mocks.analyzeStoredTransactions).not.toHaveBeenCalled();
  });

  it('importa vários CSVs e gera uma análise consolidada para o lote', async () => {
    mocks.importCsv
      .mockResolvedValueOnce({
        sourceId: 'fonte-1',
        importedCount: 2,
        categorizedCount: 2,
      })
      .mockResolvedValueOnce({
        sourceId: 'fonte-2',
        importedCount: 3,
        categorizedCount: 3,
      });
    mocks.getRagIndexStatus.mockResolvedValue({
      status: 'COMPLETE',
      totalDocuments: 2,
      pendingDocuments: 0,
      processingDocuments: 0,
      indexedDocuments: 2,
      failedDocuments: 0,
    });
    mocks.analyzeStoredTransactions.mockResolvedValue({ id: 'analise-lote' });

    const { container } = renderPage();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const firstFile = new File(
      ['description,amount,date,type\nMercado,100,2026-07-01,EXPENSE'],
      'janeiro.csv',
      { type: 'text/csv' },
    );
    const secondFile = new File(
      ['description,amount,date,type\nSalário,5000,2026-08-01,INCOME'],
      'fevereiro.csv',
      { type: 'text/csv' },
    );

    fireEvent.change(input, { target: { files: [firstFile, secondFile] } });
    fireEvent.click(screen.getByRole('button', { name: /importar 2 arquivos e gerar análise/i }));

    await waitFor(() => {
      expect(mocks.analyzeStoredTransactions).toHaveBeenCalledWith(
        'MACHINE_LEARNING',
        'CSV_IMPORT',
        undefined,
        undefined,
        ['fonte-1', 'fonte-2'],
      );
    });
    expect(mocks.importCsv).toHaveBeenNthCalledWith(1, firstFile);
    expect(mocks.importCsv).toHaveBeenNthCalledWith(2, secondFile);
    expect(mocks.getRagIndexStatus).toHaveBeenNthCalledWith(1, 'fonte-1');
    expect(mocks.getRagIndexStatus).toHaveBeenNthCalledWith(2, 'fonte-2');
    expect(screen.getByText(/2 arquivos, 5 transações importadas e 5 categorizadas/i)).toBeInTheDocument();
  });
});
