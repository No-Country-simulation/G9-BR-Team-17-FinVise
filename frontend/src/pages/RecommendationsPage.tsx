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
    <Card className="overflow-hidden border border-slate-200/80 shadow-sm transition-all hover:shadow-md">
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            {/* Ícone */}
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60 shadow-2xs">
              <Lightbulb className="h-5 w-5" />
            </div>

            {/* Conteúdo Principal */}
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-slate-900 leading-snug">
                  {recommendation.title}
                </h3>
                {recommendation.category && (
                  <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {recommendation.category}
                  </span>
                )}
              </div>

              <p className="text-sm text-slate-600 leading-relaxed">
                {recommendation.description}
              </p>

              {/* Justificativa / Motivo */}
              {recommendation.reason && (
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/70 bg-slate-50/80 px-3 py-1.5 text-xs text-slate-700">
                  <span className="font-semibold text-slate-900">Motivo:</span>
                  <span>{recommendation.reason}</span>
                </div>
              )}

              {/* Rodapé do Card (Valor e Impacto) */}
              {((recommendation.suggestedAmount != null && recommendation.suggestedAmount > 0) || impactText) && (
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2.5 mt-2 border-t border-slate-100 text-xs">
                  {recommendation.suggestedAmount != null && recommendation.suggestedAmount > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 font-medium">Valor sugerido:</span>
                      <span className="font-bold text-emerald-700 text-sm">
                        {formatCurrency(recommendation.suggestedAmount)}
                      </span>
                    </div>
                  )}
                  {impactText && (
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <span className="font-medium text-slate-700">Impacto:</span>
                      <span>{impactText}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Badge de Prioridade alinhado à direita */}
          <div className="shrink-0 self-start pt-0.5">
            <Badge variant={priorityBadge.variant} className="px-3 py-1 text-xs font-semibold shadow-2xs">
              {priorityBadge.label}
            </Badge>
          </div>
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
