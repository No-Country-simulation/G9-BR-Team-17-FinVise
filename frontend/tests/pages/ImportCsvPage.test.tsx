import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
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
});
