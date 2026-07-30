import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const sendMessageStreamMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/agentService', () => ({
  agentService: {
    sendMessageStream: sendMessageStreamMock,
  },
}));

vi.mock('@/hooks/useTransactionSource', () => ({
  useTransactionSource: () => ({
    source: 'CSV_IMPORT',
    setSource: vi.fn(),
  }),
}));

vi.mock('@/services/importSourceService', () => ({
  importSourceService: {
    getAll: vi.fn().mockResolvedValue([
      {
        id: 'arquivo-1',
        type: 'CSV',
        displayName: 'extrato.csv',
        transactionCount: 10,
      },
    ]),
  },
}));

import { AgentPage } from '@/pages/AgentPage';
import { AgentMessage } from '@/types/agent';

interface StreamHandlers {
  onConversation?: (conversationId: string) => void;
  onTools?: (tools: string[]) => void;
  onSources?: (sources: unknown[]) => void;
  onToken?: (token: string) => void;
  onDone?: (message: AgentMessage) => void;
}

function renderAgentPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AgentPage />
    </QueryClientProvider>
  );
}

describe('AgentPage streaming feedback', () => {
  beforeEach(() => {
    sendMessageStreamMock.mockReset();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('keeps thinking indicators until the first token arrives', async () => {
    let handlers: StreamHandlers = {};
    let resolveStream!: (value: {
      conversationId: string;
      message: AgentMessage;
    }) => void;
    sendMessageStreamMock.mockImplementation(
      (_request: unknown, streamHandlers: StreamHandlers) => {
        handlers = streamHandlers;
        return new Promise((resolve) => {
          resolveStream = resolve;
        });
      }
    );
    const user = userEvent.setup();
    renderAgentPage();

    await screen.findByRole('button', {
      name: 'Selecionar fontes. 1 arquivo selecionado',
    });
    await user.type(
      screen.getByPlaceholderText('Pergunte sobre os dados selecionados...'),
      'Como estou?{enter}'
    );

    expect(await screen.findByText('Pensando...')).toBeInTheDocument();
    expect(screen.getByText('Buscando evidências')).toBeInTheDocument();
    expect(screen.getByText('Calculando indicadores')).toBeInTheDocument();

    act(() => handlers.onConversation?.('conversation-1'));
    expect(screen.getByText('Pensando...')).toBeInTheDocument();

    act(() => handlers.onTools?.(['get_financial_profile']));
    expect(screen.getByText('Pensando...')).toBeInTheDocument();
    expect(screen.getByText('Lendo perfil financeiro')).toBeInTheDocument();

    act(() => handlers.onToken?.('Olá'));
    expect(screen.queryByText('Pensando...')).not.toBeInTheDocument();
    expect(screen.getByText('Olá')).toBeInTheDocument();

    const completedMessage: AgentMessage = {
      id: 'message-1',
      role: 'assistant',
      content: 'Olá!',
      timestamp: '2026-07-30T12:00:01Z',
      tools: ['simulate_savings_plan'],
    };
    await act(async () => {
      handlers.onDone?.(completedMessage);
      resolveStream({
        conversationId: 'conversation-1',
        message: completedMessage,
      });
    });

    expect(screen.getByText('Olá!')).toBeInTheDocument();
    expect(screen.getByText('Simulando plano de economia')).toBeInTheDocument();
    expect(screen.queryByText('simulate savings plan')).not.toBeInTheDocument();
    expect(sendMessageStreamMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceIds: ['arquivo-1'],
        topK: 5,
      }),
      expect.any(Object),
      expect.any(AbortSignal)
    );
  });

  it('presents sources and retrieval depth in user-friendly language', async () => {
    const user = userEvent.setup();
    renderAgentPage();

    const sourceButton = await screen.findByRole('button', {
      name: 'Selecionar fontes. 1 arquivo selecionado',
    });

    expect(screen.queryByRole('dialog', { name: 'Fontes usadas na resposta' }))
      .not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Top-k da busca' })).toHaveValue('5');
    await user.click(sourceButton);

    expect(screen.getByRole('dialog', { name: 'Fontes usadas na resposta' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Origem' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Arquivos permitidos' })).toBeInTheDocument();
    expect(screen.getByText('extrato.csv')).toBeInTheDocument();
    expect(screen.getByText('O que você quer entender hoje?')).toBeInTheDocument();
    expect(screen.getByText('Quais padrões existem nos meus gastos?')).toBeInTheDocument();
    expect(screen.queryByText('Dados usados na resposta')).not.toBeInTheDocument();
    expect(screen.queryByText('rag_retrieval')).not.toBeInTheDocument();
  });
});
