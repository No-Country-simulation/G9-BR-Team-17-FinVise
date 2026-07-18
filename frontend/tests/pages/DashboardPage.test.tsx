import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardPage } from '@/pages/DashboardPage';
import * as api from '@/lib/api';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

vi.spyOn(api.api, 'get').mockRejectedValue(new Error('Network Error'));

describe('DashboardPage', () => {
  beforeEach(() => {
    localStorage.setItem('finance_ai_token', 'fake-token');
  });

  it('renders the dashboard without fabricated financial data when the API is unavailable', async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <DashboardPage />
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Score Financeiro')).toBeInTheDocument();
    expect(screen.getByText('Total de Receitas')).toBeInTheDocument();
    expect(screen.getByText('Total de Despesas')).toBeInTheDocument();
    expect(screen.getByText('Saldo')).toBeInTheDocument();
    expect(screen.getByText(/Nenhum valor fictício será exibido/i)).toBeInTheDocument();
  });
});
