import { api } from '@/lib/api';
import {
  AgentRequest,
  AgentResponse,
  AgentConversation,
  AgentMessage,
  RagSource,
} from '@/types/agent';
import { ApiResponse } from '@/types/common';

interface BackendMessage {
  id: string;
  role: string;
  content: string;
  toolCalls?: string;
  ragSources?: string;
  createdAt: string;
}

interface BackendConversation {
  id: string;
  source: 'CSV_IMPORT' | 'OPEN_FINANCE_PLUGGY';
  sourceIds: string[];
  topK: number;
  messages: BackendMessage[];
  createdAt: string;
}

interface AgentStreamHandlers {
  onConversation?: (conversationId: string) => void;
  onTools?: (tools: string[]) => void;
  onSources?: (sources: RagSource[]) => void;
  onToken?: (token: string) => void;
  onDone?: (message: AgentMessage) => void;
}

function parseArray<T>(value?: string): T[] | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function mapMessage(message: BackendMessage): AgentMessage {
  return {
    id: message.id,
    role: message.role.toLowerCase() === 'user' ? 'user' : 'assistant',
    content: message.content,
    timestamp: message.createdAt,
    tools: parseArray<string>(message.toolCalls),
    sources: parseArray<RagSource>(message.ragSources),
  };
}

function mapConversation(source: BackendConversation): AgentConversation {
  return {
    id: source.id,
    messages: source.messages.map(mapMessage),
    createdAt: source.createdAt,
    updatedAt: source.messages.at(-1)?.createdAt || source.createdAt,
    source: source.source,
    sourceIds: source.sourceIds || [],
    topK: source.topK || 5,
  };
}

async function createConversation(request: AgentRequest): Promise<string> {
  const { data: response } = await api.post<ApiResponse<BackendConversation>>(
    '/agent/conversations',
    {
      source: request.source,
      title: request.message.slice(0, 80),
      sourceIds: request.sourceIds || [],
      topK: request.topK || 5,
    }
  );
  return response.data.id;
}

export const agentService = {
  async sendMessage(request: AgentRequest): Promise<AgentResponse> {
    const conversationId = request.conversationId || await createConversation(request);
    const { data: response } = await api.post<ApiResponse<BackendConversation>>(
      `/agent/conversations/${conversationId}/messages`,
      { content: request.message }
    );
    const assistantMessage = response.data.messages
      .map(mapMessage)
      .filter((message) => message.role === 'assistant')
      .at(-1);

    if (!assistantMessage) {
      throw new Error('O assistente não retornou uma resposta');
    }
    return { message: assistantMessage, conversationId };
  },

  async sendMessageStream(
    request: AgentRequest,
    handlers: AgentStreamHandlers = {},
    signal?: AbortSignal
  ): Promise<AgentResponse> {
    const conversationId = request.conversationId || await createConversation(request);
    handlers.onConversation?.(conversationId);

    const token = localStorage.getItem('finance_ai_token');
    const baseUrl = String(api.defaults.baseURL || '/api/v1').replace(/\/$/, '');
    const response = await fetch(
      `${baseUrl}/agent/conversations/${conversationId}/messages/stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content: request.message }),
        signal,
      }
    );

    if (!response.ok) {
      let message = `Falha ao iniciar streaming (${response.status})`;
      try {
        const errorBody = await response.json() as { message?: string };
        message = errorBody.message || message;
      } catch {
        // Mantém a mensagem baseada no status quando a resposta não é JSON.
      }
      throw new Error(message);
    }
    if (!response.body) {
      throw new Error('O navegador não disponibilizou o stream da resposta');
    }

    let completedMessage: AgentMessage | undefined;
    let buffer = '';
    const decoder = new TextDecoder();
    const reader = response.body.getReader();

    const processEvent = (block: string) => {
      let eventName = 'message';
      const dataLines: string[] = [];
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart());
        }
      }
      if (dataLines.length === 0) return;

      const rawData = dataLines.join('\n');
      if (rawData === '[DONE]') return;
      const payload = JSON.parse(rawData) as {
        conversationId?: string;
        token?: string;
        tools?: string[];
        sources?: RagSource[];
        message?: AgentMessage | string;
      };

      if (eventName === 'conversation' && payload.conversationId) {
        handlers.onConversation?.(payload.conversationId);
      } else if (eventName === 'tools') {
        handlers.onTools?.(payload.tools || []);
      } else if (eventName === 'sources') {
        handlers.onSources?.(payload.sources || []);
      } else if (eventName === 'token' && payload.token) {
        handlers.onToken?.(payload.token);
      } else if (eventName === 'done' && typeof payload.message === 'object') {
        completedMessage = payload.message;
        handlers.onDone?.(payload.message);
      } else if (eventName === 'error') {
        throw new Error(
          typeof payload.message === 'string'
            ? payload.message
            : 'O streaming da resposta foi interrompido'
        );
      }
    };

    let streamEnded = false;
    while (!streamEnded) {
      const { value, done } = await reader.read();
      streamEnded = done;
      buffer += decoder.decode(value, { stream: !done });
      buffer = buffer.replace(/\r\n/g, '\n');

      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        processEvent(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        if (completedMessage) break;
        boundary = buffer.indexOf('\n\n');
      }
      if (completedMessage) {
        await reader.cancel().catch(() => undefined);
        break;
      }
    }
    if (buffer.trim()) processEvent(buffer.trim());
    if (!completedMessage) {
      throw new Error('O streaming terminou sem confirmar a mensagem');
    }

    return { message: completedMessage, conversationId };
  },

  async getConversation(id: string): Promise<AgentConversation> {
    const { data: response } = await api.get<ApiResponse<BackendConversation>>(
      `/agent/conversations/${id}`
    );
    return mapConversation(response.data);
  },
};
