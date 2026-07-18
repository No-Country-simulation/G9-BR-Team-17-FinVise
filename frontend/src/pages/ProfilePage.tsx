import { User, Wallet, TrendingUp, Shield, FileUp, Landmark } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FinancialAnalysisResponse } from '@/types/analysis';
import { analysisService } from '@/services/analysisService';
import { formatCurrency, formatPercentage } from '@/lib/utils';
import { useTransactionSource } from '@/hooks/useTransactionSource';
import { TransactionSourceSelector } from '@/components/transactions/TransactionSourceSelector';
import { ProfileSkeleton } from '@/components/skeletons/PageSkeletons';
import { EmptyState } from '@/components/ui/EmptyState';

export function ProfilePage() {
  const { source, setSource } = useTransactionSource();
  const { data, isLoading, error } = useQuery<FinancialAnalysisResponse | null>({
    queryKey: ['analyses', 'latest', source],
    queryFn: () => analysisService.getLatest(source),
    retry: false,
  });

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  if (!data) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">Perfil Financeiro</h1>
          <p className="text-slate-500">Entenda melhor seu comportamento financeiro</p>
          </div>
          <TransactionSourceSelector value={source} onChange={setSource} />
        </div>
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={User}
              title={error ? 'Não foi possível carregar o perfil' : 'Nenhuma análise financeira disponível'}
              description={error
                ? 'Verifique a conexão e tente novamente.'
                : 'Escolha como importar suas transações. Depois da importação, gere uma análise para visualizar seu perfil real.'}
              action={!error ? (
              <div className="w-full max-w-lg space-y-3">
                <Link to="/analyses/new" className="block w-full">
                  <Button className="w-full">Analisar transações existentes</Button>
                </Link>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Link to="/import" className="w-full">
                    <Button variant="outline" className="w-full">
                      <FileUp className="mr-2 h-4 w-4" />
                      Importar arquivo CSV
                    </Button>
                  </Link>
                  <Link to="/open-finance" className="w-full">
                    <Button variant="outline" className="w-full">
                      <Landmark className="mr-2 h-4 w-4" />
                      Conectar Open Finance
                    </Button>
                  </Link>
                </div>
              </div>
              ) : undefined}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const analysis = data;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">Perfil Financeiro</h1>
          <p className="text-slate-500">Entenda melhor seu comportamento financeiro</p>
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end xl:shrink-0">
          <TransactionSourceSelector value={source} onChange={setSource} />
          <Link to="/open-finance">
            <Button className="w-full sm:w-auto">
              <Landmark className="mr-2 h-4 w-4" />
              Conectar Open Finance
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-100 text-primary-700">
              <User className="h-10 w-10" />
            </div>
            <div className="text-center sm:text-left">
              <h2 className="text-xl font-bold text-slate-900">{analysis.profile.label}</h2>
              <p className="mt-1 text-slate-600">{analysis.profile.description}</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                <Badge
                  variant={
                    analysis.profile.riskLevel === 'LOW' ? 'success' : analysis.profile.riskLevel === 'MEDIUM' ? 'warning' : 'danger'
                  }
                >
                  Risco {analysis.profile.riskLevel === 'LOW' ? 'Baixo' : analysis.profile.riskLevel === 'MEDIUM' ? 'Médio' : 'Alto'}
                </Badge>
                <Badge variant="default">Análise mais recente</Badge>
                <Badge variant="outline">
                  Modelo {analysis.modelVersions.analysisModel === 'FINANCIAL_RULES' ? 'Regras financeiras' : 'Machine Learning'}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Score do perfil</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">{analysis.profile.score.toFixed(1)}</p>
            <p className="text-xs text-slate-500">Confiança {(analysis.profile.confidence * 100).toFixed(0)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <Wallet className="h-4 w-4" />
              Reserva
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">{analysis.indicators.reserveInMonths.toFixed(1)} meses</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <TrendingUp className="h-4 w-4" />
              Poupança
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">{formatPercentage(analysis.indicators.savingsRate)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <Shield className="h-4 w-4" />
              Endividamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">{formatPercentage(analysis.indicators.debtToIncomeRatio)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <Wallet className="h-4 w-4" />
              Reserva Estimada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">
              {formatCurrency((analysis.indicators.reserveInMonths || 0) * 3000)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
