import { FinancialAnalysisResponse, Recommendation, Alert } from '@/types/analysis';
import { Transaction } from '@/types/transaction';

export const mockRecommendations: Recommendation[] = [
  {
    id: '1',
    title: 'Aumente sua reserva de emergência',
    description: 'Tente acumular pelo menos 6 meses de despesas essenciais para maior segurança.',
    priority: 'HIGH',
    category: 'Reserva',
    impact: 'Alto',
  },
  {
    id: '2',
    title: 'Reduza gastos discricionários',
    description: 'Seus gastos com lazer estão acima do recomendado. Ajuste o orçamento mensal.',
    priority: 'MEDIUM',
    category: 'Orçamento',
    impact: 'Médio',
  },
  {
    id: '3',
    title: 'Diversifique investimentos',
    description: 'Considere distribuir aplicações entre renda fixa e variável.',
    priority: 'LOW',
    category: 'Investimentos',
    impact: 'Médio',
  },
];

export const mockAlerts: Alert[] = [
  {
    id: '1',
    title: 'Endividamento elevado',
    description: 'Seu nível de endividamento está acima de 30% da renda.',
    severity: 'WARNING',
  },
];

export const mockAnalysis: FinancialAnalysisResponse = {
  id: 'demo-1',
  createdAt: new Date().toISOString(),
  profile: {
    type: 'BALANCED',
    label: 'Equilibrado',
    description: 'Suas finanças estão razoavelmente equilibradas, com espaço para melhorias.',
    riskLevel: 'MEDIUM',
    score: 62,
    confidence: 0.82,
  },
  indicators: {
    savingsRate: 18.5,
    debtToIncomeRatio: 22,
    reserveInMonths: 4.2,
    essentialExpensesRatio: 55,
    discretionaryExpensesRatio: 26.5,
  },
  spendingSummary: [
    { category: 'Moradia', amount: 2200, percentage: 32, type: 'EXPENSE' },
    { category: 'Alimentação', amount: 1200, percentage: 18, type: 'EXPENSE' },
    { category: 'Transporte', amount: 600, percentage: 9, type: 'EXPENSE' },
    { category: 'Lazer', amount: 900, percentage: 13, type: 'EXPENSE' },
    { category: 'Saúde', amount: 400, percentage: 6, type: 'EXPENSE' },
    { category: 'Outros', amount: 700, percentage: 10, type: 'EXPENSE' },
  ],
  classifiedTransactions: [],
  recommendations: mockRecommendations,
  alerts: mockAlerts,
  modelVersions: { analysisModel: 'FINANCIAL_RULES' },
};

export const mockTransactions: Transaction[] = [
  { id: '1', description: 'Salário', amount: 8500, date: '2026-06-01', type: 'INCOME', category: 'Renda' },
  { id: '2', description: 'Aluguel', amount: 2200, date: '2026-06-05', type: 'EXPENSE', category: 'Moradia' },
  { id: '3', description: 'Supermercado', amount: 850, date: '2026-06-08', type: 'EXPENSE', category: 'Alimentação' },
  { id: '4', description: 'Restaurante', amount: 180, date: '2026-06-10', type: 'EXPENSE', category: 'Lazer' },
  { id: '5', description: 'Uber', amount: 95, date: '2026-06-12', type: 'EXPENSE', category: 'Transporte' },
];

export const monthlyTrend = [
  { label: 'Jan', income: 8000, expense: 6200, balance: 1800 },
  { label: 'Fev', income: 8200, expense: 6800, balance: 1400 },
  { label: 'Mar', income: 8000, expense: 5900, balance: 2100 },
  { label: 'Abr', income: 8500, expense: 6100, balance: 2400 },
  { label: 'Mai', income: 8500, expense: 6500, balance: 2000 },
  { label: 'Jun', income: 8500, expense: 6900, balance: 1600 },
];
