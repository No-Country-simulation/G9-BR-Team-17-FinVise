import { api } from '@/lib/api';
import {
  FinancialAnalysisRequest,
  FinancialAnalysisResponse,
  ProfileAnalysisModel,
  ProfileModelOption,
} from '@/types/analysis';
import { ApiResponse } from '@/types/common';
import { TransactionSource } from '@/types/transaction';

interface BackendAnalysisResponse {
  analysisId: string;
  userId: string;
  financialProfile: {
    classification: string;
    score: number;
    confidence: number;
    mainFactors: string[];
  };
  indicators: {
    monthlyIncome: number;
    totalExpenses: number;
    incomeCommitmentPercentage: number;
    debtLevelPercentage: number;
    estimatedSavingsRate: number;
    recurringExpensesCount: number;
    fixedExpensesPercentage: number;
    nonEssentialExpensesPercentage: number;
    reserveInMonths: number;
  };
  spendingSummary: Record<string, { amount: number; percentage: number }>;
  classifiedTransactions: Array<{
    id: string;
    description: string;
    amount: number;
    date: string;
    type: 'INCOME' | 'EXPENSE';
    categoryCode: string;
    categoryName?: string;
  }>;
  recommendations: Array<{
    id: string;
    title: string;
    description: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    category: string;
    expectedImpact?: string;
  }>;
  modelVersions: Record<string, string>;
  createdAt: string;
}

const profileLabels: Record<string, string> = {
  SAUDAVEL: 'Saudável',
  EM_OBSERVACAO: 'Em observação',
  EM_RISCO: 'Em risco',
};

function mapAnalysis(source: BackendAnalysisResponse): FinancialAnalysisResponse {
  const score = Number(source.financialProfile.score || 0);
  const riskLevel = score >= 70 ? 'LOW' : score >= 50 ? 'MEDIUM' : 'HIGH';
  const classification = source.financialProfile.classification || 'EM_OBSERVACAO';

  return {
    id: source.analysisId,
    createdAt: source.createdAt,
    profile: {
      type: classification,
      label: profileLabels[classification] || classification.replace(/_/g, ' '),
      description:
        source.financialProfile.mainFactors?.join('. ') ||
        `Score financeiro ${score.toFixed(0)} com confiança de ${Math.round(
          Number(source.financialProfile.confidence || 0) * 100
        )}%.`,
      riskLevel,
      score,
      confidence: Number(source.financialProfile.confidence || 0),
    },
    indicators: {
      monthlyIncome: Number(source.indicators.monthlyIncome || 0),
      totalExpenses: Number(source.indicators.totalExpenses || 0),
      savingsRate: Number(source.indicators.estimatedSavingsRate || 0),
      debtToIncomeRatio: Number(source.indicators.debtLevelPercentage || 0),
      reserveInMonths: Number(source.indicators.reserveInMonths || 0),
      essentialExpensesRatio: Number(source.indicators.fixedExpensesPercentage || 0),
      discretionaryExpensesRatio: Number(source.indicators.nonEssentialExpensesPercentage || 0),
    },
    spendingSummary: Object.entries(source.spendingSummary || {}).map(([category, summary]) => ({
      category,
      amount: Number(summary.amount || 0),
      percentage: Number(summary.percentage || 0),
      type: 'EXPENSE' as const,
    })),
    classifiedTransactions: (source.classifiedTransactions || []).map((transaction) => ({
      id: transaction.id,
      description: transaction.description,
      amount: Number(transaction.amount),
      date: transaction.date,
      type: transaction.type,
      category: transaction.categoryName || transaction.categoryCode,
    })),
    recommendations: (source.recommendations || []).map((recommendation) => ({
      id: recommendation.id,
      title: recommendation.title,
      description: recommendation.description,
      priority: recommendation.priority,
      category: recommendation.category,
      impact: recommendation.expectedImpact,
    })),
    alerts: [],
    modelVersions: source.modelVersions || {},
  };
}

export const analysisService = {
  async getModels(): Promise<ProfileModelOption[]> {
    const { data: response } = await api.get<ApiResponse<ProfileModelOption[]>>(
      '/financial-analyses/models'
    );
    return response.data;
  },

  async analyzeStoredTransactions(
    model: ProfileAnalysisModel,
    source: TransactionSource,
    period?: { startDate?: string; endDate?: string },
    importSourceId?: string,
  ): Promise<FinancialAnalysisResponse> {
    const { data: response } = await api.post<ApiResponse<BackendAnalysisResponse>>(
      '/financial-analyses/from-transactions',
      {
        model,
        source,
        importSourceId,
        startDate: period?.startDate || undefined,
        endDate: period?.endDate || undefined,
      }
    );
    return mapAnalysis(response.data);
  },

  async create(request: FinancialAnalysisRequest): Promise<FinancialAnalysisResponse> {
    const { data: response } = await api.post<ApiResponse<BackendAnalysisResponse>>(
      '/financial-analyses',
      request
    );
    return mapAnalysis(response.data);
  },

  async getById(id: string): Promise<FinancialAnalysisResponse> {
    const { data: response } = await api.get<ApiResponse<BackendAnalysisResponse>>(
      `/financial-analyses/${id}`
    );
    return mapAnalysis(response.data);
  },

  async getLatest(
    source: TransactionSource,
    importSourceId?: string,
  ): Promise<FinancialAnalysisResponse | null> {
    const { data: response } = await api.get<ApiResponse<BackendAnalysisResponse | null>>(
      '/financial-analyses/latest',
      { params: { source, importSourceId } }
    );
    return response.data ? mapAnalysis(response.data) : null;
  },

  async getAll(source: TransactionSource): Promise<FinancialAnalysisResponse[]> {
    const { data: response } = await api.get<ApiResponse<BackendAnalysisResponse[]>>(
      '/financial-analyses',
      { params: { source } }
    );
    return response.data.map(mapAnalysis);
  },
};
