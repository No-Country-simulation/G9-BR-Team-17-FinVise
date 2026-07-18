import { api } from '@/lib/api';
import { AgentRequest, AgentResponse, AgentConversation, AgentMessage } from '@/types/agent';
import { ApiResponse } from '@/types/common';

interface BackendConversation {
  id: string;
  source: 'CSV_IMPORT' | 'OPEN_FINANCE_PLUGGY';
  messages: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: string;
  }>;
  createdAt: string;
}

function mapMessage(message: BackendConversation['messages'][number]): AgentMessage {
  return {
    id: message.id,
    role: message.role.toLowerCase() === 'user' ? 'user' : 'assistant',
    content: message.content,
    timestamp: message.createdAt,
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

  async getConversation(id: string): Promise<AgentConversation> {
    const { data: response } = await api.get<ApiResponse<BackendConversation>>(
      `/agent/conversations/${id}`
    );
    return mapConversation(response.data);
  },
};
