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
});
