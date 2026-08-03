import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  importCsv: vi.fn(),
  getRagIndexStatus: vi.fn(),
  analyzeStoredTransactions: vi.fn(),
}));

vi.mock('@/services/transactionService', () => ({
  transactionService: {
    importCsv: mocks.importCsv,
    getRagIndexStatus: mocks.getRagIndexStatus,
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

  it('acompanha a indexação enfileirada sem disparar uma segunda indexação', async () => {
    mocks.importCsv.mockResolvedValue({
      sourceId: 'fonte-123',
      importedCount: 2,
      categorizedCount: 2,
    });
    mocks.getRagIndexStatus.mockResolvedValue({
      status: 'COMPLETE',
      totalDocuments: 2,
      pendingDocuments: 0,
      processingDocuments: 0,
      indexedDocuments: 2,
      failedDocuments: 0,
    });
    mocks.analyzeStoredTransactions.mockResolvedValue({ id: 'analise-123' });

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
      expect(mocks.getRagIndexStatus).toHaveBeenCalledOnce();
    });
    expect(mocks.getRagIndexStatus).toHaveBeenCalledWith('fonte-123');
    expect(mocks.analyzeStoredTransactions).toHaveBeenCalledWith(
      'MACHINE_LEARNING',
      'CSV_IMPORT',
      undefined,
      'fonte-123',
    );
    expect(screen.getByText(/2 transações importadas; 2 categorizadas/i)).toBeInTheDocument();
  });
});
