import { SavingFrequency } from './common';

export type ProfileAnalysisModel = 'MACHINE_LEARNING' | 'FINANCIAL_RULES';

export interface ProfileModelOption {
  code: ProfileAnalysisModel;
  name: string;
  description: string;
}

export interface FinancialAnalysisTransactionInput {
  description: string;
  amount: number;
  date: string;
  type: 'INCOME' | 'EXPENSE';
}

export interface FinancialAnalysisRequest {
  monthlyIncome: number;
  debtLevelPercentage: number;
  savingFrequency: SavingFrequency;
  financialReserve: number;
  transactions: FinancialAnalysisTransactionInput[];
}

export interface FinancialProfile {
  type: string;
  label: string;
  description: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  score: number;
  confidence: number;
}

export interface FinancialIndicators {
  monthlyIncome?: number;
  totalExpenses?: number;
  savingsRate: number;
  debtToIncomeRatio: number;
  reserveInMonths: number;
  essentialExpensesRatio?: number;
  discretionaryExpensesRatio?: number;
}

export interface SpendingSummaryItem {
  category: string;
  amount: number;
  percentage: number;
  type: 'INCOME' | 'EXPENSE';
}

export interface ClassifiedTransaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  essentiality?: 'ESSENTIAL' | 'DISCRETIONARY' | 'INVESTMENT';
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  category: string;
  impact?: string;
}

export interface Alert {
  id: string;
  title: string;
  description: string;
  severity: 'INFO' | 'WARNING' | 'DANGER';
}

export interface FinancialAnalysisResponse {
  id: string;
  createdAt: string;
  profile: FinancialProfile;
  indicators: FinancialIndicators;
  spendingSummary: SpendingSummaryItem[];
  classifiedTransactions: ClassifiedTransaction[];
  recommendations: Recommendation[];
  alerts: Alert[];
  modelVersions: Record<string, string>;
}
