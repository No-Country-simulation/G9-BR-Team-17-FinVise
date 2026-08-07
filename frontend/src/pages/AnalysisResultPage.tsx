import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Lightbulb, PieChart as PieIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/Alert';
import { AnalysisResultSkeleton } from '@/components/skeletons/PageSkeletons';
import { PieChart } from '@/components/charts/PieChart';
import { formatCurrency, formatPercentage } from '@/lib/utils';
import { FinancialAnalysisResponse, Recommendation } from '@/types/analysis';
import { analysisService } from '@/services/analysisService';

function getPriorityBadge(priority: Recommendation['priority']) {
  switch (priority) {
    case 'CRITICAL':
      return { variant: 'danger' as const, label: 'Crítica' };
    case 'HIGH':
      return { variant: 'danger' as const, label: 'Alta' };
    case 'MEDIUM':
      return { variant: 'warning' as const, label: 'Média' };
    case 'LOW':
    default:
      return { variant: 'default' as const, label: 'Baixa' };
  }
}

function IndicatorCard({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">
        {suffix === 'R$' ? formatCurrency(value) : `${value.toFixed(1).replace('.', ',')}${suffix || ''}`}
      </p>
    </div>
  );
}

export function AnalysisResultPage() {
  const { analysisId } = useParams<{ analysisId: string }>();

  const { data, isLoading, error } = useQuery<FinancialAnalysisResponse>({
    queryKey: ['analysis', analysisId],
    queryFn: () => analysisService.getById(analysisId!),
    retry: false,
    enabled: !!analysisId,
  });

  const pieData = useMemo(
    () =>
      (data?.spendingSummary ?? [])
        .filter((item) => item.type === 'EXPENSE' && item.amount > 0)
        .map((item) => ({ name: item.category, value: item.amount })),
    [data]
  );

  if (isLoading) {
    return <AnalysisResultSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <Link to="/analyses/new">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Voltar
          </Button>
        </Link>
        <Alert variant="warning">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle>Análise não encontrada</AlertTitle>
          <AlertDescription>
            O resultado solicitado não existe ou não pôde ser carregado. Nenhum dado de demonstração foi exibido.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const analysis = data;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <Link to="/analyses/new">
            <Button variant="ghost" size="sm" className="mb-2 -ml-3 h-auto px-3 py-1">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Voltar
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Resultado da Análise</h1>
          <p className="text-slate-500">Análise gerada em {new Date(analysis.createdAt).toLocaleDateString('pt-BR')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="w-fit text-sm">
            {analysis.modelVersions.transactionSource === 'OPEN_FINANCE_PLUGGY' ? 'Open Finance' : 'Arquivo CSV'}
          </Badge>
          <Badge
            variant={analysis.profile.riskLevel === 'LOW' ? 'success' : analysis.profile.riskLevel === 'MEDIUM' ? 'warning' : 'danger'}
            className="w-fit text-sm"
          >
            {analysis.profile.label}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Perfil Financeiro</CardTitle>
          <CardDescription>{analysis.profile.label}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-slate-700">{analysis.profile.description}</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            <IndicatorCard label="Score do perfil" value={analysis.profile.score} />
            <IndicatorCard label="Taxa de poupança" value={analysis.indicators.savingsRate} suffix="%" />
            <IndicatorCard label="Endividamento" value={analysis.indicators.debtToIncomeRatio} suffix="%" />
            <IndicatorCard label="Reserva (meses)" value={analysis.indicators.reserveInMonths} />
            <IndicatorCard label="Despesas essenciais" value={analysis.indicators.essentialExpensesRatio || 0} suffix="%" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieIcon className="h-5 w-5 text-primary-600" />
              Gastos por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PieChart data={pieData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumo de Gastos</CardTitle>
            <CardDescription>Detalhamento por categoria</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analysis.spendingSummary.map((item) => (
                <div key={item.category} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-sm font-medium text-slate-700">{item.category}</span>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">{formatCurrency(item.amount)}</p>
                    <p className="text-xs text-slate-500">{formatPercentage(item.percentage)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-warning" />
            Recomendações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {analysis.recommendations.map((rec) => {
            const badge = getPriorityBadge(rec.priority);
            const impactText = rec.expectedImpact || rec.impact;
            return (
              <div key={rec.id} className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-200/60">
                      <Lightbulb className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <p className="font-semibold text-slate-900 leading-snug">{rec.title}</p>
                      <p className="text-sm text-slate-600 leading-relaxed">{rec.description}</p>
                      {rec.reason && (
                        <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/70 bg-slate-50/80 px-2.5 py-1 text-xs text-slate-700">
                          <span className="font-semibold text-slate-900">Motivo:</span>
                          <span>{rec.reason}</span>
                        </div>
                      )}
                      {((rec.suggestedAmount != null && rec.suggestedAmount > 0) || impactText) && (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 border-t border-slate-100 text-xs">
                          {rec.suggestedAmount != null && rec.suggestedAmount > 0 && (
                            <span className="font-semibold text-emerald-700">
                              Valor sugerido: {formatCurrency(rec.suggestedAmount)}
                            </span>
                          )}
                          {impactText && (
                            <span className="text-slate-500">Impacto: {impactText}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge variant={badge.variant} className="self-start px-2.5 py-0.5 text-xs font-semibold">
                    {badge.label}
                  </Badge>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {analysis.alerts.length > 0 && (
        <Alert variant="warning">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle>Alertas</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-inside list-disc space-y-1">
              {analysis.alerts.map((alert) => (
                <li key={alert.id}>{alert.description}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
