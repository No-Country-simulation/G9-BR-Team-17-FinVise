import { TransactionSource } from './transaction';

export interface RagSource {
  id: string;
  source_id?: string;
  source_name?: string;
  chunk_type: 'TRANSACTION' | 'MONTHLY_SUMMARY' | 'CATEGORY_SUMMARY' | string;
  score?: number;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  tools?: string[];
  sources?: RagSource[];
}

export interface AgentConversation {
  id: string;
  messages: AgentMessage[];
  createdAt: string;
  updatedAt: string;
  source: TransactionSource;
  sourceIds: string[];
  topK: number;
  totalMessages: number;
  messagePage: number;
  messageSize: number;
  hasOlderMessages: boolean;
}

export interface AgentRequest {
  message: string;
  source: TransactionSource;
  conversationId?: string;
  sourceIds?: string[];
  topK?: number;
  clientMessageId?: string;
  context?: Record<string, unknown>;
}

export interface AgentResponse {
  message: AgentMessage;
  conversationId: string;
}
