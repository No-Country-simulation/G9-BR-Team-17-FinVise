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

function RecommendationCard({ recommendation }: { recommendation: Recommendation }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <Lightbulb className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">{recommendation.title}</p>
              <p className="mt-1 text-sm text-slate-600">{recommendation.description}</p>
              {recommendation.impact && (
                <p className="mt-2 text-xs text-slate-500">Impacto: {recommendation.impact}</p>
              )}
            </div>
          </div>
          <Badge
            variant={
              recommendation.priority === 'HIGH' ? 'danger' : recommendation.priority === 'MEDIUM' ? 'warning' : 'default'
            }
          >
            {recommendation.priority === 'HIGH' ? 'Alta' : recommendation.priority === 'MEDIUM' ? 'Média' : 'Baixa'}
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
