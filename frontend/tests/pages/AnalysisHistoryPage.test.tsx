import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinancialAnalysisResponse } from '@/types/analysis';

const mocks = vi.hoisted(() => ({
  getAll: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/services/analysisService', () => ({
  analysisService: mocks,
}));

import { AnalysisHistoryPage } from '@/pages/AnalysisHistoryPage';

const analysis: FinancialAnalysisResponse = {
  id: 'analysis-123',
  createdAt: '2026-07-16T12:00:00Z',
  profile: {
    type: 'SAUDAVEL',
    label: 'Saudável',
    description: 'Perfil financeiro equilibrado.',
    riskLevel: 'LOW',
    score: 82,
    confidence: 0.9,
  },
  indicators: {
    monthlyIncome: 5000,
    totalExpenses: 2500,
    savingsRate: 50,
    debtToIncomeRatio: 10,
    reserveInMonths: 4,
    essentialExpensesRatio: 45,
    discretionaryExpensesRatio: 20,
  },
  spendingSummary: [],
  classifiedTransactions: [],
  recommendations: [],
  alerts: [],
  modelVersions: { transactionSource: 'CSV_IMPORT' },
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AnalysisHistoryPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AnalysisHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAll.mockResolvedValue({
      content: [analysis],
      totalElements: 1,
      totalPages: 1,
      size: 12,
      number: 0,
    });
    mocks.delete.mockResolvedValue(undefined);
  });

  it('usa o seletor visual padronizado para filtrar a origem', async () => {
    const user = userEvent.setup();
    renderPage();

    const selector = await screen.findByRole('combobox', { name: 'Origem dos dados' });
    expect(selector).toHaveTextContent('Todas as fontes');

    await user.click(selector);
    await user.click(screen.getByRole('option', { name: /Open Finance/i }));

    await waitFor(() => {
      expect(mocks.getAll).toHaveBeenCalledWith('OPEN_FINANCE_PLUGGY', 0, 12);
    });
  });

  it('confirma e exclui uma análise individualmente', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /Excluir análise de/i }));
    expect(screen.getByRole('dialog', { name: 'Excluir esta análise?' })).toBeInTheDocument();
    expect(screen.getByText(/Suas transações não serão alteradas/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Excluir análise' }));

    await waitFor(() => expect(mocks.delete).toHaveBeenCalledWith('analysis-123'));
    expect(await screen.findByText(/foi excluída/i)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
