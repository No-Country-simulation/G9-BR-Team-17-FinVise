import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, BrainCircuit, FileUp, Landmark, Scale } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/Alert';
import { InlineMetricsSkeleton } from '@/components/skeletons/PageSkeletons';
import { analysisService } from '@/services/analysisService';
import { importSourceService } from '@/services/importSourceService';
import { transactionService } from '@/services/transactionService';
import { extractErrorMessage } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { ProfileAnalysisModel } from '@/types/analysis';
import { useTransactionSource } from '@/hooks/useTransactionSource';
import { TransactionSourceSelector } from '@/components/transactions/TransactionSourceSelector';
import { TransactionSource } from '@/types/transaction';

const modelOptions: Array<{
  code: ProfileAnalysisModel;
  name: string;
  description: string;
  icon: typeof BrainCircuit;
}> = [
  {
    code: 'MACHINE_LEARNING',
    name: 'Machine Learning',
    description: 'Modelo treinado que combina os padrões de renda, gastos, frequência e categorias.',
    icon: BrainCircuit,
  },
  {
    code: 'FINANCIAL_RULES',
    name: 'Regras financeiras',
    description: 'Modelo determinístico, conservador e explicável por limites financeiros conhecidos.',
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
  const { data: summary } = useQuery({
    queryKey: ['transactions', 'summary', source, effectiveImportSourceId],
    queryFn: () => transactionService.getSummary(source, effectiveImportSourceId),
    enabled: !sourcesLoading,
  });

  const transactionCount = transactionPage?.totalElements ?? 0;

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await analysisService.analyzeStoredTransactions(model, source, {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }, effectiveImportSourceId);
      navigate(`/analyses/${result.id}`);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-none space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Analisar transações</h1>
        <p className="text-sm text-slate-500 sm:text-base">Escolha um dos dois modelos para analisar os dados já importados</p>
      </div>

      {error && (
        <Alert variant="danger">
          <AlertTitle>Não foi possível gerar a análise</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Dados disponíveis</CardTitle>
          <CardDescription>A análise usa as transações persistidas, sem criar duplicidades.</CardDescription>
        </CardHeader>
        <CardContent>
          <TransactionSourceSelector
            value={source}
            onChange={(nextSource) => {
              setSource(nextSource);
              rememberSource(nextSource);
              setSelectedImportSourceId('');
            }}
            className="mb-5 block max-w-sm"
            label="Analisar somente"
          />
          {compatibleSources.length > 0 && (
            <label className="mb-5 block max-w-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Fonte importada
              </span>
              <Select
                aria-label="Fonte importada"
                value={effectiveImportSourceId ?? ''}
                onChange={(event) => setSelectedImportSourceId(event.target.value)}
                options={compatibleSources.map((item) => ({
                  value: item.id,
                  label: `${item.defaultSource ? '★ ' : ''}${item.displayName}`,
                }))}
              />
            </label>
          )}
          {transactionsLoading || sourcesLoading ? (
            <InlineMetricsSkeleton />
          ) : transactionCount === 0 ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-slate-500">Nenhuma transação foi importada.</p>
              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  to="/import"
                  className="inline-flex h-14 items-center justify-center rounded-[14px] bg-[linear-gradient(180deg,#5fe6ea_0%,#2fcbd7_100%)] px-5 py-2 text-[16px] font-semibold tracking-tight text-slate-950 shadow-[0_12px_30px_rgba(45,212,191,0.20)] transition-all duration-200 hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                >
                  <FileUp className="mr-2 h-4 w-4" />Importar CSV
                </Link>
                <Link
                  to="/open-finance"
                  className="inline-flex h-14 items-center justify-center rounded-[14px] border border-slate-300 bg-white/80 px-5 py-2 text-[16px] font-semibold tracking-tight text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50 focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                >
                  <Landmark className="mr-2 h-4 w-4" />Open Finance
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div><p className="text-xs text-slate-500">Transações</p><p className="text-xl font-bold">{transactionCount.toLocaleString('pt-BR')}</p></div>
              <div><p className="text-xs text-slate-500">Receitas</p><p className="text-xl font-bold text-emerald-600">{formatCurrency(summary?.totalIncome ?? 0)}</p></div>
              <div><p className="text-xs text-slate-500">Despesas</p><p className="text-xl font-bold text-red-600">{formatCurrency(summary?.totalExpense ?? 0)}</p></div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Modelo de análise</CardTitle>
          <CardDescription>Você pode executar novamente com outro modelo para comparar os resultados.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {modelOptions.map((option) => {
            const Icon = option.icon;
            const selected = model === option.code;
            return (
              <button
                key={option.code}
                type="button"
                onClick={() => setModel(option.code)}
                className={`rounded-xl border-2 p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${selected ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:border-primary-200 focus-visible:border-primary-200'}`}
                aria-pressed={selected}
              >
                <Icon className={`mb-3 h-7 w-7 ${selected ? 'text-primary-700' : 'text-slate-500'}`} />
                <p className="font-semibold text-slate-900">{option.name}</p>
                <p className="mt-1 text-sm text-slate-500">{option.description}</p>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Período opcional</CardTitle>
          <CardDescription>Deixe em branco para analisar todo o histórico da fonte selecionada.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Data inicial</label>
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Data final</label>
            <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={handleAnalyze}
          disabled={transactionCount === 0 || transactionsLoading || sourcesLoading || isAnalyzing}
          isLoading={isAnalyzing}
        >
          {isAnalyzing ? 'Analisando transações...' : `Analisar com ${model === 'MACHINE_LEARNING' ? 'Machine Learning' : 'Regras financeiras'}`}
          {!isAnalyzing && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
