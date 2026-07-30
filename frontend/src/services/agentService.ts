import { api } from '@/lib/api';
import { AgentRequest, AgentResponse, AgentConversation, AgentMessage } from '@/types/agent';
import { ApiResponse } from '@/types/common';

interface BackendMessage {
  id: string;
  role: string;
  content: string;
  toolCalls?: string;
  createdAt: string;
}

interface BackendConversation {
  id: string;
  source: 'CSV_IMPORT' | 'OPEN_FINANCE_PLUGGY';
  messages: BackendMessage[];
  createdAt: string;
}

interface AgentStreamHandlers {
  onConversation?: (conversationId: string) => void;
  onTools?: (tools: string[]) => void;
  onToken?: (token: string) => void;
  onDone?: (message: AgentMessage) => void;
}

function mapMessage(message: BackendMessage): AgentMessage {
  let tools: string[] | undefined;
  if (message.toolCalls) {
    try {
      const parsed = JSON.parse(message.toolCalls);
      if (Array.isArray(parsed)) {
        tools = parsed;
      }
    } catch {
      tools = undefined;
    }
  }

  return {
    id: message.id,
    role: message.role.toLowerCase() === 'user' ? 'user' : 'assistant',
    content: message.content,
    timestamp: message.createdAt,
    tools,
  };
}

function mapConversation(source: BackendConversation): AgentConversation {
  return {
    id: source.id,
    messages: source.messages.map(mapMessage),
    createdAt: source.createdAt,
    updatedAt: source.messages.at(-1)?.createdAt || source.createdAt,
    source: source.source,
  };
}

export const agentService = {
  async sendMessage(request: AgentRequest): Promise<AgentResponse> {
    let conversationId = request.conversationId;

    if (!conversationId) {
      const { data: createResponse } = await api.post<ApiResponse<BackendConversation>>(
        '/agent/conversations',
        {
          source: request.source,
          title: request.message.slice(0, 80),
        }
      );
      conversationId = createResponse.data.id;
    }

    const { data: sendResponse } = await api.post<ApiResponse<BackendConversation>>(
      `/agent/conversations/${conversationId}/messages`,
      { content: request.message }
    );
    const assistantMessage = sendResponse.data.messages
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
    let conversationId = request.conversationId;

    if (!conversationId) {
      const { data: createResponse } = await api.post<ApiResponse<BackendConversation>>(
        '/agent/conversations',
        {
          source: request.source,
          title: request.message.slice(0, 80),
        }
      );
      conversationId = createResponse.data.id;
    }

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
        // Keep the status-based message when the response is not JSON.
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
        message?: AgentMessage | string;
      };

      if (eventName === 'conversation' && payload.conversationId) {
        handlers.onConversation?.(payload.conversationId);
      } else if (eventName === 'tools') {
        handlers.onTools?.(payload.tools || []);
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
        boundary = buffer.indexOf('\n\n');
      }
    }
    if (buffer.trim()) {
      processEvent(buffer.trim());
    }
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
