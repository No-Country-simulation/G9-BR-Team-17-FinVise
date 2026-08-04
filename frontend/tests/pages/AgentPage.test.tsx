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
      screen.getByPlaceholderText('Pergunte sobre seus dados...'),
      'Como estou?{enter}'
    );

    expect(await screen.findByText('Pensando...')).toBeInTheDocument();
    expect(screen.queryByText('Vamos começar?')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Parar resposta' })).toBeInTheDocument();
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

    const completedAnswer = screen.getByText('Olá!');
    expect(completedAnswer).toBeInTheDocument();
    expect(completedAnswer.closest('[data-message-role="assistant"]'))
      .toHaveClass('bg-slate-100/80');
    expect(screen.getByText('Simulando plano de economia')).toBeInTheDocument();
    expect(screen.queryByText('simulate savings plan')).not.toBeInTheDocument();
    expect(sendMessageStreamMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceIds: ['arquivo-1'],
        topK: 5,
        clientMessageId: expect.any(String),
      }),
      expect.any(Object),
      expect.any(AbortSignal)
    );
  });

  it('stops the active response from the composer', async () => {
    let requestSignal: AbortSignal | undefined;
    sendMessageStreamMock.mockImplementation(
      (_request: unknown, _handlers: StreamHandlers, signal: AbortSignal) => {
        requestSignal = signal;
        return new Promise((_resolve, reject) => {
          signal.addEventListener(
            'abort',
            () => reject(new DOMException('Resposta interrompida', 'AbortError')),
            { once: true }
          );
        });
      }
    );
    const user = userEvent.setup();
    renderAgentPage();

    await screen.findByRole('button', {
      name: 'Selecionar fontes. 1 arquivo selecionado',
    });
    await user.type(
      screen.getByPlaceholderText('Pergunte sobre seus dados...'),
      'Analise meus gastos{enter}'
    );

    const stopButton = await screen.findByRole('button', { name: 'Parar resposta' });
    await user.click(stopButton);

    expect(requestSignal?.aborted).toBe(true);
    expect(screen.queryByText('Pensando...')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar mensagem' })).toBeInTheDocument();
  });

  it('presents sources and retrieval depth in user-friendly language', async () => {
    const user = userEvent.setup();
    renderAgentPage();

    const sourceButton = await screen.findByRole('button', {
      name: 'Selecionar fontes. 1 arquivo selecionado',
    });

    expect(screen.queryByRole('dialog', { name: 'Fontes usadas na resposta' }))
      .not.toBeInTheDocument();
    const depthSelector = screen.getByRole('combobox', {
      name: 'Profundidade da recuperação',
    });
    expect(depthSelector).toHaveTextContent('Equilibrado');
    expect(screen.queryByRole('listbox', { name: 'Opções de profundidade' }))
      .not.toBeInTheDocument();

    await user.click(depthSelector);
    expect(screen.getByRole('listbox', { name: 'Opções de profundidade' }))
      .toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^Mínimo/ })).toHaveAttribute(
      'aria-selected',
      'false'
    );
    expect(screen.getByRole('option', { name: /^Equilibrado/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('option', { name: /^Estendido/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^Máximo/ })).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: /^Estendido/ }));
    expect(depthSelector).toHaveTextContent('Estendido');

    await user.click(sourceButton);

    expect(screen.getByRole('dialog', { name: 'Fontes usadas na resposta' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Origem' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Arquivos permitidos' })).toBeInTheDocument();
    const selectedFile = screen.getByRole('checkbox', { name: 'extrato.csv' });
    expect(selectedFile).toBeChecked();
    expect(selectedFile.closest('label')).toHaveClass('bg-slate-100');
    expect(selectedFile.closest('label')).not.toHaveClass('focus-within:ring-2');
    expect(screen.getByText('Vamos começar?')).toBeInTheDocument();
    expect(screen.queryByText('Assistente Financeiro')).not.toBeInTheDocument();
    expect(screen.queryByText('Quais padrões existem nos meus gastos?')).not.toBeInTheDocument();
    expect(screen.queryByText('Dados usados na resposta')).not.toBeInTheDocument();
    expect(screen.queryByText('rag_retrieval')).not.toBeInTheDocument();
  });
});
