export type TransactionType = 'INCOME' | 'EXPENSE';
export type TransactionSource = 'CSV_IMPORT' | 'OPEN_FINANCE_PLUGGY';

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: TransactionType;
  category?: string;
  source?: TransactionSource;
  createdAt?: string;
}

export interface TransactionSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

export interface MonthlyTransactionSummary {
  month: string;
  income: number;
  expense: number;
  balance: number;
}
