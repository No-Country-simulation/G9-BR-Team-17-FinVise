import { Lightbulb, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { RecommendationListSkeleton } from '@/components/skeletons/PageSkeletons';
import { Link } from 'react-router-dom';
import { FinancialAnalysisResponse, Recommendation } from '@/types/analysis';
import { analysisService } from '@/services/analysisService';
import { useTransactionSource } from '@/hooks/useTransactionSource';
import { TransactionSourceSelector } from '@/components/transactions/TransactionSourceSelector';
import { formatCurrency } from '@/lib/utils';

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

function RecommendationCard({ recommendation }: { recommendation: Recommendation }) {
  const priorityBadge = getPriorityBadge(recommendation.priority);
  const impactText = recommendation.expectedImpact || recommendation.impact;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <Lightbulb className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="font-semibold text-slate-900">{recommendation.title}</p>
              <p className="text-sm text-slate-600">{recommendation.description}</p>

              {recommendation.reason && (
                <p className="text-xs font-medium text-slate-700 bg-slate-50 rounded px-2.5 py-1 inline-block border border-slate-200/60">
                  Motivo: {recommendation.reason}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-slate-500">
                {recommendation.suggestedAmount != null && recommendation.suggestedAmount > 0 && (
                  <span className="font-semibold text-emerald-700">
                    Valor sugerido: {formatCurrency(recommendation.suggestedAmount)}
                  </span>
                )}
                {impactText && (
                  <span>Impacto: {impactText}</span>
                )}
              </div>
            </div>
          </div>
          <Badge variant={priorityBadge.variant}>
            {priorityBadge.label}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export function RecommendationsPage() {
  const { source, setSource } = useTransactionSource();
  const { data, isLoading } = useQuery<FinancialAnalysisResponse | null>({
    queryKey: ['analyses', 'latest', source],
    queryFn: () => analysisService.getLatest(source),
    retry: false,
  });

  const recommendations = data?.recommendations ?? [];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recomendações</h1>
          <p className="text-slate-500">Sugestões para melhorar suas finanças</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end xl:shrink-0">
          <TransactionSourceSelector value={source} onChange={setSource} />
          <Link to="/analyses/new">
            <Button>
              Nova Análise
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <RecommendationListSkeleton />
      ) : recommendations.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Lightbulb}
              title="Nenhuma recomendação disponível"
              description="Gere uma nova análise para receber recomendações personalizadas."
              action={(
                <Link to="/analyses/new" className="inline-flex">
                  <Button>
                    Nova análise
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              )}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {recommendations.map((rec) => (
            <RecommendationCard key={rec.id} recommendation={rec} />
          ))}
        </div>
      )}
    </div>
  );
}
