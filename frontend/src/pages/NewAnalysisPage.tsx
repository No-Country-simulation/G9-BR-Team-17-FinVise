import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, BrainCircuit, FileUp, Landmark, Scale } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/Alert';
import { InlineMetricsSkeleton } from '@/components/skeletons/PageSkeletons';
import { analysisService } from '@/services/analysisService';
import { transactionService } from '@/services/transactionService';
import { extractErrorMessage } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { ProfileAnalysisModel } from '@/types/analysis';
import { useTransactionSource } from '@/hooks/useTransactionSource';
import { TransactionSourceSelector } from '@/components/transactions/TransactionSourceSelector';

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
  const { source, setSource } = useTransactionSource();
  const [model, setModel] = useState<ProfileAnalysisModel>('MACHINE_LEARNING');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: transactionPage, isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions', 'analysis-count', source],
    queryFn: () => transactionService.getAll({ page: 0, size: 1, source }),
  });
  const { data: summary } = useQuery({
    queryKey: ['transactions', 'summary', source],
    queryFn: () => transactionService.getSummary(source),
  });

  const transactionCount = transactionPage?.totalElements ?? 0;

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await analysisService.analyzeStoredTransactions(model, source, {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      navigate(`/analyses/${result.id}`);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6">
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
            onChange={setSource}
            className="mb-5 block max-w-sm"
            label="Analisar somente"
          />
          {transactionsLoading ? (
            <InlineMetricsSkeleton />
          ) : transactionCount === 0 ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-slate-500">Nenhuma transação foi importada.</p>
              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <Link to="/import">
                  <Button><FileUp className="mr-2 h-4 w-4" />Importar CSV</Button>
                </Link>
                <Link to="/open-finance">
                  <Button variant="outline"><Landmark className="mr-2 h-4 w-4" />Open Finance</Button>
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
                className={`rounded-xl border-2 p-5 text-left transition-colors ${selected ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:border-primary-200'}`}
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
          <CardDescription>Deixe em branco para analisar todo o histórico importado.</CardDescription>
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
          disabled={transactionCount === 0 || transactionsLoading || isAnalyzing}
          isLoading={isAnalyzing}
        >
          {isAnalyzing ? 'Analisando transações...' : `Analisar com ${model === 'MACHINE_LEARNING' ? 'Machine Learning' : 'Regras financeiras'}`}
          {!isAnalyzing && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
