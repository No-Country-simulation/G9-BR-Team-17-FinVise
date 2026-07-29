export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  tools?: string[];
}

export interface AgentConversation {
  id: string;
  messages: AgentMessage[];
  createdAt: string;
  updatedAt: string;
  source: TransactionSource;
}

export interface AgentRequest {
  message: string;
  source: TransactionSource;
  conversationId?: string;
  context?: Record<string, unknown>;
}

export interface AgentResponse {
  message: AgentMessage;
  conversationId: string;
}
import { TransactionSource } from './transaction';
