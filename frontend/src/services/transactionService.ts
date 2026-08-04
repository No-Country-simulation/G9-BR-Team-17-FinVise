import { api } from '@/lib/api';
import { ApiResponse, PaginatedResponse } from '@/types/common';
import { MonthlyTransactionSummary, Transaction, TransactionSource, TransactionSummary } from '@/types/transaction';

export interface TransactionFilters {
  page?: number;
  size?: number;
  startDate?: string;
  endDate?: string;
  type?: string;
  category?: string;
  source?: TransactionSource;
  importSourceId?: string;
}

export interface RagIndexStatus {
  status: 'EMPTY' | 'PENDING' | 'PROCESSING' | 'COMPLETE' | 'FAILED';
  totalDocuments: number;
  pendingDocuments: number;
  processingDocuments: number;
  indexedDocuments: number;
  failedDocuments: number;
}

export interface RagIndexQueueStatus {
  status: 'EMPTY' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'DEAD_LETTER';
  attempts: number;
  rerunRequested: boolean;
  nextAttemptAt: string | null;
  heartbeatAt: string | null;
  deadLetteredAt: string | null;
  lastError: string | null;
  manualReprocessCount: number;
  updatedAt: string | null;
}

export const transactionService = {
  async getAll(filters: TransactionFilters = {}): Promise<PaginatedResponse<Transaction>> {
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== '' && value != null),
    );
    const { data: response } = await api.get<ApiResponse<PaginatedResponse<Transaction>>>('/transactions', {
      params,
    });
    return response.data;
  },

  async getSummary(source: TransactionSource, importSourceId?: string): Promise<TransactionSummary> {
    const { data: response } = await api.get<ApiResponse<TransactionSummary>>('/transactions/summary', {
      params: { source, importSourceId },
    });
    return response.data;
  },

  async getMonthlySummary(source: TransactionSource, importSourceId?: string): Promise<MonthlyTransactionSummary[]> {
    const { data: response } = await api.get<ApiResponse<MonthlyTransactionSummary[]>>(
      '/transactions/monthly-summary',
      { params: { source, importSourceId } },
    );
    return response.data;
  },

  async getCategorySummary(
    source: TransactionSource,
    importSourceId?: string,
  ): Promise<Array<{ category: string; amount: number }>> {
    const { data: response } = await api.get<
      ApiResponse<Array<{ category: string; amount: number }>>
    >('/transactions/category-summary', {
      params: { source, importSourceId },
    });
    return response.data;
  },

  async importCsv(file: File): Promise<{
    sourceId: string;
    importedCount: number;
    categorizedCount: number;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    const { data: response } = await api.post<ApiResponse<{
      id: string;
      processedCount: number;
      categorizedCount: number;
    }>>('/imports/transactions/csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
    return {
      sourceId: response.data.id,
      importedCount: response.data.processedCount,
      categorizedCount: response.data.categorizedCount,
    };
  },

  async getRagIndexStatus(sourceId: string): Promise<RagIndexStatus> {
    const { data } = await api.get<RagIndexStatus>('/rag/status', {
      params: { sourceIds: sourceId },
    });
    return data;
  },

  async getRagIndexQueueStatus(): Promise<RagIndexQueueStatus> {
    const { data } = await api.get<RagIndexQueueStatus>('/rag/queue');
    return data;
  },
};
