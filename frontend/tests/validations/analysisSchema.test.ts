import { describe, it, expect } from 'vitest';
import { analysisRequestSchema } from '@/validations/analysisSchema';

describe('analysisRequestSchema', () => {
  const validPayload = {
    monthlyIncome: 5000,
    debtLevelPercentage: 20,
    savingFrequency: 'MEDIUM',
    financialReserve: 10000,
    transactions: [
      { description: 'Salário', amount: 5000, date: '2026-06-01', type: 'INCOME' },
      { description: 'Aluguel', amount: 1200, date: '2026-06-05', type: 'EXPENSE' },
    ],
  };

  it('validates a correct payload', () => {
    const result = analysisRequestSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('fails when monthlyIncome is zero or negative', () => {
    const result = analysisRequestSchema.safeParse({ ...validPayload, monthlyIncome: 0 });
    expect(result.success).toBe(false);
  });

  it('fails when debtLevelPercentage is greater than 100', () => {
    const result = analysisRequestSchema.safeParse({ ...validPayload, debtLevelPercentage: 101 });
    expect(result.success).toBe(false);
  });

  it('fails when transactions list is empty', () => {
    const result = analysisRequestSchema.safeParse({ ...validPayload, transactions: [] });
    expect(result.success).toBe(false);
  });

  it('fails when transaction has invalid type', () => {
    const result = analysisRequestSchema.safeParse({
      ...validPayload,
      transactions: [{ description: 'X', amount: 10, date: '2026-06-01', type: 'INVALID' }],
    });
    expect(result.success).toBe(false);
  });
});
