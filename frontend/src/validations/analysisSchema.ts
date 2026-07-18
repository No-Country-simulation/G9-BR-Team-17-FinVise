import { z } from 'zod';

export const transactionInputSchema = z.object({
  description: z.string().min(2, 'Descrição deve ter pelo menos 2 caracteres'),
  amount: z.coerce.number().positive('O valor deve ser maior que zero'),
  date: z.string().min(1, 'Informe a data'),
  type: z.enum(['INCOME', 'EXPENSE']),
});

export const analysisRequestSchema = z.object({
  monthlyIncome: z.coerce.number().positive('Renda mensal deve ser maior que zero'),
  debtLevelPercentage: z.coerce
    .number()
    .min(0, 'Percentual mínimo é 0')
    .max(100, 'Percentual máximo é 100'),
  savingFrequency: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  financialReserve: z.coerce.number().min(0, 'Reserva não pode ser negativa'),
  transactions: z.array(transactionInputSchema).min(1, 'Adicione pelo menos uma transação'),
});

export type AnalysisFormData = z.infer<typeof analysisRequestSchema>;
