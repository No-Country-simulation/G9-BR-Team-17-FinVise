import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockedGet = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  api: {
    get: mockedGet,
  },
}));

import { transactionService } from '@/services/transactionService';

describe('transactionService', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('consulta o status RAG apenas para a fonte importada', async () => {
    const status = {
      status: 'PROCESSING',
      totalDocuments: 4,
      pendingDocuments: 1,
      processingDocuments: 1,
      indexedDocuments: 2,
      failedDocuments: 0,
    };
    mockedGet.mockResolvedValue({ data: status });

    await expect(transactionService.getRagIndexStatus('fonte-123')).resolves.toEqual(status);
    expect(mockedGet).toHaveBeenCalledWith('/rag/status', {
      params: { sourceIds: 'fonte-123' },
    });
  });

  it('consulta o estado operacional da fila RAG', async () => {
    const status = {
      status: 'DEAD_LETTER',
      attempts: 5,
      rerunRequested: false,
      nextAttemptAt: null,
      heartbeatAt: null,
      deadLetteredAt: '2026-08-04T12:00:00Z',
      lastError: 'falha permanente',
      manualReprocessCount: 0,
      updatedAt: '2026-08-04T12:00:00Z',
    };
    mockedGet.mockResolvedValue({ data: status });

    await expect(transactionService.getRagIndexQueueStatus()).resolves.toEqual(status);
    expect(mockedGet).toHaveBeenCalledWith('/rag/queue');
  });
});
