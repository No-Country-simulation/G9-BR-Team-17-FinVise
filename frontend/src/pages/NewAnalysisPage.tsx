import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  BrainCircuit,
  CalendarRange,
  Check,
  CheckCircle2,
  Database,
  FileUp,
  Landmark,
  Scale,
  Sparkles,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { InlineMetricsSkeleton } from '@/components/skeletons/PageSkeletons';
import { TransactionSourceSelector } from '@/components/transactions/TransactionSourceSelector';
import { useTransactionSource } from '@/hooks/useTransactionSource';
import { analysisService } from '@/services/analysisService';
import { importSourceService } from '@/services/importSourceService';
import { transactionService } from '@/services/transactionService';
import { extractErrorMessage } from '@/lib/api';
import { cn, formatCurrency } from '@/lib/utils';
import { ProfileAnalysisModel } from '@/types/analysis';
import { TransactionSource } from '@/types/transaction';

type PeriodMode = 'ALL' | 'CUSTOM';

const modelOptions: Array<{
  code: ProfileAnalysisModel;
  name: string;
  description: string;
  benefit: string;
  icon: typeof BrainCircuit;
}> = [
  {
    code: 'MACHINE_LEARNING',
    name: 'Machine Learning',
    description: 'Identifica padrões combinados de renda, gastos, frequência e categorias.',
    benefit: 'Recomendado para uma visão mais completa',
    icon: BrainCircuit,
  },
  {
    code: 'FINANCIAL_RULES',
    name: 'Regras financeiras',
    description: 'Aplica limites financeiros conhecidos, conservadores e explicáveis.',
    benefit: 'Ideal para um resultado direto e previsível',
    icon: Scale,
  },
];

export function NewAnalysisPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { source: rememberedSource, setSource: rememberSource } = useTransactionSource();
  const requestedSource = searchParams.get('source');
  const initialSource: TransactionSource = requestedSource === 'OPEN_FINANCE_PLUGGY'
    ? 'OPEN_FINANCE_PLUGGY'
    : requestedSource === 'CSV_IMPORT'
      ? 'CSV_IMPORT'
      : rememberedSource;

  const [source, setSource] = useState<TransactionSource>(initialSource);
  const [selectedImportSourceId, setSelectedImportSourceId] = useState(
    searchParams.get('importSourceId') ?? '',
  );
  const [model, setModel] = useState<ProfileAnalysisModel>('MACHINE_LEARNING');
  const [periodMode, setPeriodMode] = useState<PeriodMode>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: importSources = [], isLoading: sourcesLoading } = useQuery({
    queryKey: ['import-sources'],
    queryFn: importSourceService.getAll,
  });

  const compatibleSources = importSources.filter((item) => (
    source === 'CSV_IMPORT' ? item.type === 'CSV' : item.type === 'OPEN_FINANCE'
  ));
  const effectiveImportSourceId = compatibleSources.some(
    (item) => item.id === selectedImportSourceId,
  )
    ? selectedImportSourceId
    : compatibleSources.find((item) => item.defaultSource)?.id
      ?? compatibleSources[0]?.id;
  const selectedImportSource = compatibleSources.find((item) => item.id === effectiveImportSourceId);

  const { data: transactionPage, isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions', 'analysis-count', source, effectiveImportSourceId],
    queryFn: () => transactionService.getAll({
      page: 0,
      size: 1,
      source,
      importSourceId: effectiveImportSourceId,
    }),
    enabled: !sourcesLoading,
  });
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['transactions', 'summary', source, effectiveImportSourceId],
    queryFn: () => transactionService.getSummary(source, effectiveImportSourceId),
    enabled: !sourcesLoading,
  });

  const transactionCount = transactionPage?.totalElements ?? 0;
  const dataIsLoading = sourcesLoading || transactionsLoading || summaryLoading;
  const hasTransactions = !dataIsLoading && transactionCount > 0;
  const selectedModel = modelOptions.find((option) => option.code === model) ?? modelOptions[0];
  const periodError = periodMode === 'CUSTOM'
    ? !startDate || !endDate
      ? 'Informe as datas inicial e final.'
      : startDate > endDate
        ? 'A data inicial deve ser anterior à data final.'
        : null
    : null;
  const canAnalyze = hasTransactions && !periodError && !isAnalyzing;

  const handleSourceChange = (nextSource: TransactionSource) => {
    setSource(nextSource);
    rememberSource(nextSource);
    setSelectedImportSourceId('');
    setError(null);
  };

  const handleAnalyze = async () => {
    if (!canAnalyze) {
      if (periodError) setError(periodError);
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await analysisService.analyzeStoredTransactions(
        model,
        source,
        periodMode === 'CUSTOM' ? { startDate, endDate } : undefined,
        effectiveImportSourceId,
      );
      navigate(`/analyses/${result.id}`);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 sm:space-y-6">
      <header className="max-w-3xl">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary-600">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Nova análise
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Transforme seus dados em próximos passos
        </h1>
        <p className="mt-1 text-sm leading-6 text-slate-500 sm:text-base">
          Confirme a fonte, escolha o tipo de análise e revise antes de gerar o resultado.
        </p>
      </header>

      <ol className="grid grid-cols-3 gap-2" aria-label="Etapas da nova análise">
        <ProgressStep number={1} label="Dados" active completed={hasTransactions} />
        <ProgressStep number={2} label="Modelo" active={hasTransactions} completed={hasTransactions} />
        <ProgressStep number={3} label="Revisão" active={hasTransactions} />
      </ol>

      {error && (
        <Alert variant="danger">
          <AlertTitle>Revise as informações</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className={cn('grid gap-5', hasTransactions && 'xl:grid-cols-[minmax(0,1fr)_21rem] xl:items-start')}>
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <StepIcon number={1} complete={hasTransactions} />
                <div>
                  <CardTitle>Escolha os dados</CardTitle>
                  <CardDescription>Selecione de onde vêm as transações que serão analisadas.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <TransactionSourceSelector
                  value={source}
                  onChange={handleSourceChange}
                  label="Origem das transações"
                />
                {compatibleSources.length > 0 && (
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Conta ou arquivo
                    </span>
                    <Select
                      aria-label="Conta ou arquivo importado"
                      value={effectiveImportSourceId ?? ''}
                      onChange={(event) => {
                        setSelectedImportSourceId(event.target.value);
                        setError(null);
                      }}
                      options={compatibleSources.map((item) => ({
                        value: item.id,
                        label: `${item.defaultSource ? '★ ' : ''}${item.displayName}`,
                      }))}
                    />
                  </label>
                )}
              </div>

              {dataIsLoading ? (
                <div className="mt-5"><InlineMetricsSkeleton /></div>
              ) : !hasTransactions ? (
                <EmptySource source={source} />
              ) : (
                <dl className="mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 sm:gap-4 sm:p-4">
                  <Metric label="Transações" value={transactionCount.toLocaleString('pt-BR')} />
                  <Metric label="Receitas" value={formatCurrency(summary?.totalIncome ?? 0)} tone="positive" />
                  <Metric label="Despesas" value={formatCurrency(summary?.totalExpense ?? 0)} tone="negative" />
                </dl>
              )}
            </CardContent>
          </Card>

          {hasTransactions && (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <StepIcon number={2} />
                    <div>
                      <CardTitle>Escolha como analisar</CardTitle>
                      <CardDescription>Os dois métodos usam os mesmos dados e geram recomendações.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  {modelOptions.map((option) => {
                    const Icon = option.icon;
                    const selected = model === option.code;
                    return (
                      <button
                        key={option.code}
                        type="button"
                        onClick={() => {
                          setModel(option.code);
                          setError(null);
                        }}
                        className={cn(
                          'relative rounded-2xl border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:p-5',
                          selected
                            ? 'border-primary-500 bg-primary-50 shadow-sm'
                            : 'border-slate-200 bg-white/40 hover:border-primary-200 hover:bg-white/70'
                        )}
                        aria-pressed={selected}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-xl',
                            selected ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-500'
                          )}>
                            <Icon className="h-5 w-5" aria-hidden="true" />
                          </div>
                          {selected && (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-white">
                              <Check className="h-4 w-4" aria-hidden="true" />
                            </span>
                          )}
                        </div>
                        <p className="mt-3 font-semibold text-slate-900">{option.name}</p>
                        <p className="mt-1 text-sm leading-5 text-slate-500">{option.description}</p>
                        <p className="mt-3 text-xs font-medium text-primary-700">{option.benefit}</p>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <StepIcon number={3} />
                    <div>
                      <CardTitle>Defina o período</CardTitle>
                      <CardDescription>Use todo o histórico ou concentre a análise em um intervalo.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <PeriodOption
                      selected={periodMode === 'ALL'}
                      title="Todo o histórico"
                      description="Melhor para uma visão completa"
                      onClick={() => {
                        setPeriodMode('ALL');
                        setError(null);
                      }}
                    />
                    <PeriodOption
                      selected={periodMode === 'CUSTOM'}
                      title="Período personalizado"
                      description="Compare um intervalo específico"
                      onClick={() => {
                        setPeriodMode('CUSTOM');
                        setError(null);
                      }}
                    />
                  </div>

                  {periodMode === 'CUSTOM' && (
                    <div className="mt-4 grid gap-4 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2">
                      <label>
                        <span className="mb-1 block text-sm font-medium text-slate-700">Data inicial</span>
                        <Input
                          type="date"
                          value={startDate}
                          max={endDate || undefined}
                          onChange={(event) => {
                            setStartDate(event.target.value);
                            setError(null);
                          }}
                        />
                      </label>
                      <label>
                        <span className="mb-1 block text-sm font-medium text-slate-700">Data final</span>
                        <Input
                          type="date"
                          value={endDate}
                          min={startDate || undefined}
                          onChange={(event) => {
                            setEndDate(event.target.value);
                            setError(null);
                          }}
                        />
                      </label>
                      {periodError && (
                        <p className="text-sm text-red-600 sm:col-span-2" role="alert">{periodError}</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {hasTransactions && (
          <Card className="xl:sticky xl:top-24">
            <CardHeader>
              <CardTitle>Revisar e gerar</CardTitle>
              <CardDescription>Confira as escolhas antes de continuar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="space-y-3 text-sm">
                <ReviewRow label="Fonte" value={selectedImportSource?.displayName ?? (source === 'CSV_IMPORT' ? 'Arquivo CSV' : 'Open Finance')} />
                <ReviewRow label="Transações" value={transactionCount.toLocaleString('pt-BR')} />
                <ReviewRow label="Modelo" value={selectedModel.name} />
                <ReviewRow
                  label="Período"
                  value={periodMode === 'ALL' ? 'Todo o histórico' : startDate && endDate ? `${formatDate(startDate)} a ${formatDate(endDate)}` : 'Defina as datas'}
                />
              </dl>
              <Button
                className="w-full"
                size="lg"
                onClick={handleAnalyze}
                disabled={!canAnalyze}
                isLoading={isAnalyzing}
              >
                {isAnalyzing ? 'Gerando análise...' : 'Gerar análise'}
                {!isAnalyzing && <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />}
              </Button>
              <p className="text-center text-xs leading-5 text-slate-500">
                Seus dados importados não serão duplicados ou alterados.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function ProgressStep({ number, label, active, completed = false }: {
  number: number;
  label: string;
  active: boolean;
  completed?: boolean;
}) {
  return (
    <li className={cn(
      'flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-xs font-semibold sm:px-4 sm:text-sm',
      active ? 'border-primary-200 bg-primary-50 text-primary-800' : 'border-slate-200 bg-white/40 text-slate-400'
    )}>
      <span className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px]',
        active ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-500'
      )}>
        {completed ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : number}
      </span>
      <span className="truncate">{label}</span>
    </li>
  );
}

function StepIcon({ number, complete = false }: { number: number; complete?: boolean }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 font-bold text-primary-700">
      {complete ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> : number}
    </div>
  );
}

function EmptySource({ source }: { source: TransactionSource }) {
  const isCsv = source === 'CSV_IMPORT';
  const Icon = isCsv ? FileUp : Landmark;
  return (
    <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center sm:p-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-100 text-primary-700">
        <Database className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="mt-3 font-semibold text-slate-900">Nenhuma transação nesta fonte</h2>
      <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
        {isCsv
          ? 'Importe um arquivo CSV para liberar as próximas etapas da análise.'
          : 'Conecte uma instituição financeira para liberar as próximas etapas da análise.'}
      </p>
      <Link
        to={isCsv ? '/import' : '/open-finance'}
        className="app-primary-button mt-4 inline-flex h-11 items-center justify-center rounded-full bg-[#078da2] px-5 text-sm font-semibold text-white shadow-[0_10px_30px_-16px_rgba(0,188,214,0.55)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
      >
        <Icon className="mr-2 h-4 w-4" aria-hidden="true" />
        {isCsv ? 'Importar arquivo CSV' : 'Conectar Open Finance'}
      </Link>
    </div>
  );
}

function Metric({ label, value, tone = 'default' }: {
  label: string;
  value: string;
  tone?: 'default' | 'positive' | 'negative';
}) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[11px] text-slate-500 sm:text-xs">{label}</dt>
      <dd className={cn(
        'mt-0.5 truncate text-sm font-bold tabular-nums sm:text-lg',
        tone === 'positive' && 'text-emerald-600',
        tone === 'negative' && 'text-red-600',
        tone === 'default' && 'text-slate-900'
      )} title={value}>{value}</dd>
    </div>
  );
}

function PeriodOption({ selected, title, description, onClick }: {
  selected: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
        selected ? 'border-primary-500 bg-primary-50' : 'border-slate-200 bg-white/40 hover:border-primary-200'
      )}
      aria-pressed={selected}
    >
      <CalendarRange className={cn('h-5 w-5 shrink-0', selected ? 'text-primary-700' : 'text-slate-400')} aria-hidden="true" />
      <span className="min-w-0">
        <span className="block font-semibold text-slate-900">{title}</span>
        <span className="mt-0.5 block text-xs text-slate-500">{description}</span>
      </span>
    </button>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="max-w-[60%] text-right font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(`${value}T12:00:00`));
}
