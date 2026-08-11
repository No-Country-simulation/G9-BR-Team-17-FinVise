import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, DollarSign, PiggyBank, AlertTriangle, Bot, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/Alert';
import { DashboardSkeleton } from '@/components/skeletons/PageSkeletons';
import { PieChart } from '@/components/charts/PieChart';
import { LineChart } from '@/components/charts/LineChart';
import { formatCurrency, formatPercentage } from '@/lib/utils';
import { FinancialAnalysisResponse } from '@/types/analysis';
import { analysisService } from '@/services/analysisService';
import { transactionService } from '@/services/transactionService';
import { useTransactionSource } from '@/hooks/useTransactionSource';
import { Select } from '@/components/ui/Select';
import { importSourceService } from '@/services/importSourceService';
import { TransactionSource } from '@/types/transaction';
import { GenerateReportButton } from '@/components/ui/ButtonReport';


function transactionSource(type: 'CSV' | 'OPEN_FINANCE'): TransactionSource {
  return type === 'CSV' ? 'CSV_IMPORT' : 'OPEN_FINANCE_PLUGGY';
}

function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
  variant = 'default',
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  trend?: string;
  variant?: 'default' | 'success' | 'danger' | 'warning';
}) {
  const colors = {
    default: 'bg-primary-50 text-primary-700',
    success: 'bg-emerald-50 text-emerald-700',
    danger: 'bg-red-50 text-red-700',
    warning: 'bg-amber-50 text-amber-700',
  };

  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex min-h-16 items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="mt-1 whitespace-nowrap text-xl font-bold tabular-nums text-slate-900 sm:text-2xl" title={value}>{value}</p>
            {trend && <p className="mt-1 text-xs text-slate-500">{trend}</p>}
          </div>
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 ${colors[variant]}`}>
            <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { source: rememberedSource, setSource } = useTransactionSource();
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const { data: importSources = [], isLoading: sourcesLoading } = useQuery({
    queryKey: ['import-sources'],
    queryFn: importSourceService.getAll,
  });
  const selectedImportSource = importSources.find((item) => item.id === selectedSourceId)
    || importSources.find((item) => item.defaultSource)
    || importSources[0]
    || null;
  const source = selectedImportSource
    ? transactionSource(selectedImportSource.type)
    : rememberedSource;
  const importSourceId = selectedImportSource?.id;
  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
  } = useQuery({
    queryKey: ['transactions', 'summary', source, importSourceId],
    queryFn: () => transactionService.getSummary(source, importSourceId),
    enabled: !sourcesLoading,
  });

  const { data: monthlySummary = [], isLoading: monthlyLoading } = useQuery({
    queryKey: ['transactions', 'monthly-summary', source, importSourceId],
    queryFn: () => transactionService.getMonthlySummary(source, importSourceId),
    enabled: !sourcesLoading,
  });

  const { data: categorySummary = [], isLoading: categoryLoading } = useQuery({
    queryKey: ['transactions', 'category-summary', source, importSourceId],
    queryFn: () => transactionService.getCategorySummary(source, importSourceId),
    enabled: !sourcesLoading,
  });

  const {
    data: latestAnalysis,
    isLoading: analysisLoading,
    error: analysisError,
  } = useQuery<FinancialAnalysisResponse | null>({
    queryKey: ['analyses', 'latest', source, importSourceId],
    queryFn: async () => {
      const sourceAnalysis = await analysisService.getLatest(source, importSourceId);
      if (sourceAnalysis || !importSourceId) return sourceAnalysis;
      return analysisService.getLatest(source);
    },
    retry: false,
    enabled: !sourcesLoading,
  });

  const analysis = latestAnalysis ?? null;
  const isGeneralAnalysis = Boolean(
    analysis
      && importSourceId
      && analysis.modelVersions.importSourceId !== importSourceId,
  );
  const newAnalysisUrl = importSourceId
    ? `/analyses/new?source=${source}&importSourceId=${importSourceId}`
    : `/analyses/new?source=${source}`;

  const pieData = useMemo(
    () =>
      categorySummary
        .filter((item) => item.amount > 0)
        .map((item) => ({ name: item.category, value: item.amount })),
    [categorySummary]
  );

  const score = useMemo(() => {
    if (!analysis) return null;
    return Math.min(100, Math.max(0, Math.round(analysis.profile.score)));
  }, [analysis]);

  const trendData = useMemo(() => {
    return monthlySummary.map((month) => ({
      label: new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' })
        .format(new Date(`${month.month}-01T12:00:00`)),
      income: month.income,
      expense: month.expense,
      balance: month.balance,
    }));
  }, [monthlySummary]);

  const isLoading = sourcesLoading || summaryLoading || analysisLoading || monthlyLoading || categoryLoading;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 sm:text-base">Visão geral da sua saúde financeira</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(17rem,1fr)_auto] sm:items-end xl:shrink-0">
          {selectedImportSource && (
            <label className="block min-w-0">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Fonte dos dados
              </span>
              <Select
                aria-label="Fonte dos dados"
                value={selectedImportSource.id}
                onChange={(event) => {
                  const selected = importSources.find((item) => item.id === event.target.value);
                  setSelectedSourceId(event.target.value);
                  if (selected) setSource(transactionSource(selected.type));
                }}
                options={importSources.map((item) => ({
                  value: item.id,
                  label: `${item.defaultSource ? '★ ' : ''}${item.displayName}`,
                }))}
              />
            </label>
          )}
          <div className="flex gap-2">
            <GenerateReportButton source={source} importSourceId={importSourceId} />
            <Link to={newAnalysisUrl}>
              <Button className="w-full whitespace-nowrap sm:w-auto">
                Nova Análise
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {(summaryError || analysisError) && (
        <Alert variant="warning">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle>Não foi possível carregar todos os dados</AlertTitle>
          <AlertDescription>
            Verifique a conexão e tente novamente. Nenhum valor fictício será exibido.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <MetricCard
          title="Score Financeiro"
          value={score?.toString() ?? '—'}
          icon={TrendingUp}
          trend={score === null
            ? 'Gere uma análise'
            : `${score >= 70 ? 'Excelente' : score >= 50 ? 'Bom' : 'Precisa de atenção'}${isGeneralAnalysis ? ' · análise geral' : ''}`}
          variant={score === null ? 'default' : score >= 70 ? 'success' : score >= 50 ? 'warning' : 'danger'}
        />
        <MetricCard
          title="Total de Receitas"
          value={formatCurrency(summary?.totalIncome ?? 0)}
          icon={DollarSign}
          variant="success"
        />
        <MetricCard
          title="Total de Despesas"
          value={formatCurrency(summary?.totalExpense ?? 0)}
          icon={TrendingDown}
          variant="danger"
        />
        <MetricCard
          title="Saldo"
          value={formatCurrency(summary?.balance ?? 0)}
          icon={PiggyBank}
          variant={(summary?.balance ?? 0) >= 0 ? 'success' : 'danger'}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Resumo das Transações</CardTitle>
            <CardDescription>
              {selectedImportSource
                ? `Série mensal de ${selectedImportSource.displayName}`
                : `Série mensal de ${source === 'CSV_IMPORT' ? 'Arquivo CSV' : 'Open Finance'}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LineChart data={trendData} emptyMessage="Importe transações para visualizar o resumo" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gastos por Categoria</CardTitle>
            <CardDescription>Distribuição das despesas</CardDescription>
          </CardHeader>
          <CardContent>
            <PieChart data={pieData} />
          </CardContent>
        </Card>
      </div>

      <Link
        to="/agent"
        className="flex min-h-20 items-center justify-between gap-3 rounded-[28px] border border-cyan-200/20 bg-[#078da2] p-4 text-white shadow-[0_10px_32px_-16px_rgba(0,188,214,0.55)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#079aae] hover:shadow-[0_14px_38px_-14px_rgba(0,188,214,0.48)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
      >
        <div className="flex items-center gap-3">
          <Bot className="h-6 w-6" />
          <div className="min-w-0">
            <p className="font-semibold">Falar com o Assistente Financeiro</p>
            <p className="mt-0.5 text-xs opacity-70">Tire dúvidas e receba dicas personalizadas</p>
          </div>
        </div>
        <ArrowRight className="h-5 w-5" />
      </Link>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Perfil Atual</CardTitle>
            <CardDescription>{analysis?.profile.label ?? 'Nenhuma análise gerada'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {analysis ? (
              <>
                <p className="text-sm text-slate-600">{analysis.profile.description}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={analysis.profile.riskLevel === 'LOW' ? 'success' : analysis.profile.riskLevel === 'MEDIUM' ? 'warning' : 'danger'}>
                    Risco {analysis.profile.riskLevel === 'LOW' ? 'Baixo' : analysis.profile.riskLevel === 'MEDIUM' ? 'Médio' : 'Alto'}
                  </Badge>
                  <Badge variant="default">Taxa de poupança {formatPercentage(analysis.indicators.savingsRate)}</Badge>
                  <Badge variant="outline">Reserva {analysis.indicators.reserveInMonths.toFixed(1)} meses</Badge>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">Gere uma análise para conhecer seu perfil financeiro.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Principais Recomendações</CardTitle>
            <CardDescription>Sugestões personalizadas para você</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(analysis?.recommendations ?? []).slice(0, 3).map((rec) => (
              <div key={rec.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <p className="min-w-0 flex-1 text-sm font-medium text-slate-900">{rec.title}</p>
                  <Badge
                    variant={rec.priority === 'HIGH' ? 'danger' : rec.priority === 'MEDIUM' ? 'warning' : 'default'}
                    className="text-[10px]"
                  >
                    {rec.priority === 'HIGH' ? 'Alta' : rec.priority === 'MEDIUM' ? 'Média' : 'Baixa'}
                  </Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{rec.description}</p>
              </div>
            ))}
            {!analysis && (
              <p className="text-sm text-slate-500">Nenhuma recomendação disponível sem uma análise.</p>
            )}
            <Link to="/recommendations">
              <Button variant="ghost" size="sm" className="w-full">
                Ver todas
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {analysis && analysis.alerts.length > 0 && (
        <Alert variant="warning">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle>Alertas</AlertTitle>
          <AlertDescription>{analysis.alerts[0].description}</AlertDescription>
        </Alert>
      )}

    </div>
  );
}
