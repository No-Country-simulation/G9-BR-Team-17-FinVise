import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleGauge,
  FileClock,
  WalletCards,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { formatCurrency, formatPercentage } from '@/lib/utils';
import { analysisService } from '@/services/analysisService';
import { FinancialAnalysisResponse } from '@/types/analysis';
import { TransactionSource } from '@/types/transaction';

type SourceFilter = 'ALL' | TransactionSource;

const pageSize = 12;

const sourceOptions = [
  { value: 'ALL', label: 'Todas as fontes' },
  { value: 'CSV_IMPORT', label: 'Arquivos importados' },
  { value: 'OPEN_FINANCE_PLUGGY', label: 'Open Finance' },
];

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function getSourceLabel(analysis: FinancialAnalysisResponse) {
  const source = analysis.modelVersions.transactionSource;
  if (source === 'OPEN_FINANCE_PLUGGY') return 'Open Finance';
  if (source === 'CSV_IMPORT') return 'Arquivo importado';
  return 'Análise geral';
}

function getProfileBadge(riskLevel: FinancialAnalysisResponse['profile']['riskLevel']) {
  if (riskLevel === 'LOW') return 'success' as const;
  if (riskLevel === 'MEDIUM') return 'warning' as const;
  return 'danger' as const;
}

export function AnalysisHistoryPage() {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('ALL');
  const [page, setPage] = useState(0);
  const selectedSource = sourceFilter === 'ALL' ? undefined : sourceFilter;

  useEffect(() => {
    setPage(0);
  }, [sourceFilter]);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['analyses', 'history', selectedSource, page],
    queryFn: () => analysisService.getAll(selectedSource, page, pageSize),
    placeholderData: (previousData) => previousData,
    retry: false,
  });

  const analyses = data?.content ?? [];
  const averageScore = analyses.length === 0
    ? null
    : Math.round(
        analyses.reduce((total, analysis) => total + analysis.profile.score, 0) / analyses.length
      );

  return (
    <div className="space-y-4 sm:space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary-600">
            <FileClock className="h-4 w-4" aria-hidden="true" />
            Linha do tempo financeira
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Histórico de análises
          </h1>
          <p className="mt-1 text-sm leading-6 text-slate-500 sm:text-base">
            Compare a evolução da sua saúde financeira e retome qualquer análise anterior.
          </p>
        </div>

        <label className="block w-full sm:max-w-xs">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Origem dos dados
          </span>
          <Select
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value as SourceFilter)}
            options={sourceOptions}
            aria-label="Filtrar histórico por origem dos dados"
          />
        </label>
      </header>

      {!isLoading && !error && analyses.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-2" aria-label="Resumo do histórico">
          <Card className="rounded-[22px]">
            <CardContent className="flex items-center gap-3 p-4 sm:p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                <WalletCards className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Análises encontradas</p>
                <p className="text-xl font-bold tabular-nums text-slate-900">{data?.totalElements ?? 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-[22px]">
            <CardContent className="flex items-center gap-3 p-4 sm:p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <CircleGauge className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Score médio nesta página</p>
                <p className="text-xl font-bold tabular-nums text-slate-900">{averageScore ?? '—'}</p>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {isLoading && (
        <Card>
          <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 p-8" role="status">
            <Spinner size="lg" />
            <p className="text-sm text-slate-500">Carregando suas análises...</p>
          </CardContent>
        </Card>
      )}

      {error && !isLoading && (
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="font-semibold text-slate-900">Não foi possível carregar o histórico</h2>
            <p className="mt-1 text-sm text-slate-500">Verifique sua conexão e tente novamente.</p>
            <Button className="mt-5" variant="secondary" onClick={() => window.location.reload()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && analyses.length === 0 && (
        <Card>
          <CardContent className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-100 text-primary-700">
              <FileClock className="h-7 w-7" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">Nenhuma análise encontrada</h2>
            <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
              Quando você gerar uma análise pelo Dashboard, ela aparecerá aqui automaticamente.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && analyses.length > 0 && (
        <section className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3" aria-label="Análises anteriores">
          {analyses.map((analysis) => (
            <Card key={analysis.id} className="group rounded-[22px] transition-transform duration-200 hover:-translate-y-0.5">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <time dateTime={analysis.createdAt}>{dateFormatter.format(new Date(analysis.createdAt))}</time>
                    </div>
                    <h2 className="mt-2 truncate text-base font-semibold text-slate-900">
                      {analysis.profile.label}
                    </h2>
                  </div>
                  <Badge variant={getProfileBadge(analysis.profile.riskLevel)}>
                    Score {Math.round(analysis.profile.score)}
                  </Badge>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-3 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500">Receitas</dt>
                    <dd className="mt-0.5 truncate font-semibold tabular-nums text-slate-900">
                      {formatCurrency(analysis.indicators.monthlyIncome ?? 0)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Despesas</dt>
                    <dd className="mt-0.5 truncate font-semibold tabular-nums text-slate-900">
                      {formatCurrency(analysis.indicators.totalExpenses ?? 0)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Taxa de poupança</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">
                      {formatPercentage(analysis.indicators.savingsRate)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Origem</dt>
                    <dd className="mt-0.5 truncate font-semibold text-slate-900">
                      {getSourceLabel(analysis)}
                    </dd>
                  </div>
                </dl>

                <Link
                  to={`/analyses/${analysis.id}`}
                  className="mt-4 flex min-h-10 items-center justify-between rounded-xl px-3 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
                  aria-label={`Ver detalhes da análise de ${dateFormatter.format(new Date(analysis.createdAt))}`}
                >
                  Ver análise completa
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {(data?.totalPages ?? 0) > 1 && (
        <nav className="flex items-center justify-between gap-3" aria-label="Paginação do histórico de análises">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={page === 0 || isFetching}
          >
            <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
            Anterior
          </Button>
          <p className="text-center text-xs font-medium text-slate-500 sm:text-sm">
            Página {page + 1} de {data?.totalPages}
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((current) => current + 1)}
            disabled={page + 1 >= (data?.totalPages ?? 0) || isFetching}
          >
            Próxima
            <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
          </Button>
        </nav>
      )}
    </div>
  );
}
