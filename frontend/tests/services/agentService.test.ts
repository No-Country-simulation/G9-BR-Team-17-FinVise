import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockedPost = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  api: {
    post: mockedPost,
    defaults: { baseURL: '/api/v1' },
  },
}));

import { agentService } from '@/services/agentService';

describe('agentService streaming', () => {
  beforeEach(() => {
    mockedPost.mockReset();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('consumes SSE events and returns the persisted assistant message', async () => {
    mockedPost.mockResolvedValue({
      data: {
        data: {
          id: 'conversation-1',
          source: 'CSV_IMPORT',
          messages: [],
          createdAt: '2026-07-30T12:00:00Z',
        },
      },
    });
    const finalMessage = {
      id: 'message-1',
      role: 'assistant' as const,
      content: 'Olá!',
      timestamp: '2026-07-30T12:00:01Z',
      tools: ['get_financial_profile'],
    };
    const sseBody = [
      'event: conversation',
      'data: {"conversationId":"conversation-1"}',
      '',
      'event: tools',
      'data: {"tools":["get_financial_profile"]}',
      '',
      'event: token',
      'data: {"token":"Olá"}',
      '',
      'event: token',
      'data: {"token":"!"}',
      '',
      'event: done',
      `data: ${JSON.stringify({ conversationId: 'conversation-1', message: finalMessage })}`,
      '',
      '',
    ].join('\n');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(sseBody, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );
    localStorage.setItem('finance_ai_token', 'jwt-token');
    const tokens: string[] = [];
    const tools: string[][] = [];

    const result = await agentService.sendMessageStream(
      { message: 'Como estou?', source: 'CSV_IMPORT' },
      {
        onToken: (token) => tokens.push(token),
        onTools: (eventTools) => tools.push(eventTools),
      }
    );

    expect(mockedPost).toHaveBeenCalledWith('/agent/conversations', {
      source: 'CSV_IMPORT',
      title: 'Como estou?',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/agent/conversations/conversation-1/messages/stream',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer jwt-token',
          Accept: 'text/event-stream',
        }),
      })
    );
    expect(tokens).toEqual(['Olá', '!']);
    expect(tools).toEqual([['get_financial_profile']]);
    expect(result).toEqual({
      conversationId: 'conversation-1',
      message: finalMessage,
    });
  });

  it('rejects a stream that ends without a done event', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('event: token\ndata: {"token":"incompleto"}\n\n', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    await expect(agentService.sendMessageStream({
      message: 'Teste',
      conversationId: 'conversation-1',
      source: 'CSV_IMPORT',
    })).rejects.toThrow('sem confirmar a mensagem');
  });

  it('stops reading after done and ignores a later transport failure', async () => {
    const encoder = new TextEncoder();
    let readCount = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        readCount += 1;
        if (readCount === 1) {
          controller.enqueue(encoder.encode(
            'event: done\n'
            + 'data: {"conversationId":"conversation-1","message":'
            + '{"id":"message-1","role":"assistant","content":"Pronto",'
            + '"timestamp":"2026-07-30T12:00:01Z"}}\n\n'
          ));
          return;
        }
        controller.error(new TypeError('network error'));
      },
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }));

    const result = await agentService.sendMessageStream({
      message: 'Teste',
      conversationId: 'conversation-1',
      source: 'CSV_IMPORT',
    });

    expect(result.message.content).toBe('Pronto');
  });
});
