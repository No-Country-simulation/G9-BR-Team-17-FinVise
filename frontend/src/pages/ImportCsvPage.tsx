import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Upload, FileCheck, AlertTriangle, Landmark, Database, Cpu, Layers, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { Select } from '@/components/ui/Select';
import { transactionService } from '@/services/transactionService';
import { analysisService } from '@/services/analysisService';
import { extractErrorMessage } from '@/lib/api';
import { ProfileAnalysisModel } from '@/types/analysis';
import { rememberTransactionSource } from '@/hooks/useTransactionSource';
import { useTheme } from '@/components/auth/useTheme';
import { cn } from '@/lib/utils';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const CSV_CONTENT_TYPES = ['text/csv', 'application/csv', 'application/vnd.ms-excel'];
const RAG_STATUS_POLL_INTERVAL_MS = 1000;
const INDEXING_PROGRESS_START = 20;
const INDEXING_PROGRESS_RANGE = 60;

type ImportPhase = 'IDLE' | 'UPLOADING' | 'INDEXING' | 'ANALYZING' | 'COMPLETED';

class RagIndexingFailedError extends Error {}

function toAccessibleImportErrorMessage(rawMessage: string): string {
  const normalized = rawMessage.toLowerCase();

  if (
    normalized.includes('rollback-only')
    || normalized.includes('silently rolled back')
    || normalized.includes('transaction rolled back')
  ) {
    return 'Nao foi possivel concluir a importacao por uma inconsistencia temporaria no servidor. Tente novamente em alguns instantes.';
  }

  if (
    normalized.includes('network')
    || normalized.includes('failed to fetch')
    || normalized.includes('timeout')
    || normalized.includes('ecconnaborted')
  ) {
    return 'Falha de conexao durante a importacao. Verifique sua rede e tente novamente.';
  }

  if (normalized.includes('payload too large') || normalized.includes('413')) {
    return 'O arquivo enviado e maior do que o limite permitido. Use um CSV de ate 5 MB.';
  }

  return rawMessage;
}

const wait = (milliseconds: number) => new Promise((resolve) => {
  window.setTimeout(resolve, milliseconds);
});

export function ImportCsvPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusStep, setStatusStep] = useState('');
  const [batchInfo, setBatchInfo] = useState<string>('');
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [model, setModel] = useState<ProfileAnalysisModel>('MACHINE_LEARNING');
  const [phase, setPhase] = useState<ImportPhase>('IDLE');
  const inputRef = useRef<HTMLInputElement>(null);

  const updateIndexingProgress = (
    indexedDocuments: number,
    totalDocuments: number,
    remainingDocuments: number,
  ) => {
    const indexingRatio = totalDocuments > 0
      ? Math.min(1, indexedDocuments / totalDocuments)
      : 0;
    setProgress(Math.min(
      INDEXING_PROGRESS_START + INDEXING_PROGRESS_RANGE,
      INDEXING_PROGRESS_START + Math.floor(indexingRatio * INDEXING_PROGRESS_RANGE),
    ));
    setBatchInfo(
      `${indexedDocuments.toLocaleString('pt-BR')} de ${totalDocuments.toLocaleString('pt-BR')} documentos vetorizados`
      + (remainingDocuments > 0
        ? `; ${remainingDocuments.toLocaleString('pt-BR')} restantes.`
        : '.'),
    );
  };

  const waitForRagIndexing = async (sourceId: string) => {
    let consecutiveReadFailures = 0;
    let indexingFinished = false;

    while (!indexingFinished) {
      try {
        const status = await transactionService.getRagIndexStatus(sourceId);
        const remainingDocuments = status.pendingDocuments
          + status.processingDocuments
          + status.failedDocuments;

        updateIndexingProgress(
          status.indexedDocuments,
          status.totalDocuments,
          remainingDocuments,
        );
        consecutiveReadFailures = 0;

        if (status.status === 'COMPLETE' || status.status === 'EMPTY') {
          setProgress(INDEXING_PROGRESS_START + INDEXING_PROGRESS_RANGE);
          setStatusStep('2/4 Indexação vetorial concluída.');
          if (status.status === 'EMPTY') {
            setBatchInfo('Nenhum documento precisava ser vetorizado.');
          }
          indexingFinished = true;
          break;
        }

        if (status.failedDocuments > 0) {
          const queue = await transactionService.getRagIndexQueueStatus();
          if (queue.status === 'DEAD_LETTER') {
            throw new RagIndexingFailedError(
              'A indexação vetorial falhou após esgotar as tentativas. Tente reprocessar a fonte em instantes.',
            );
          }
          if (queue.status === 'COMPLETED' || queue.status === 'EMPTY') {
            throw new RagIndexingFailedError(
              'A fila foi concluída, mas ainda existem documentos sem vetor. Solicite o reprocessamento da fonte.',
            );
          }
          setStatusStep(`2/4 Reprocessando indexação vetorial (tentativa ${queue.attempts + 1})...`);
        } else if (status.status === 'PROCESSING') {
          setStatusStep('2/4 Indexando e vetorizando documentos...');
        } else {
          setStatusStep('2/4 Aguardando processamento da fila de indexação...');
        }
      } catch (error) {
        if (error instanceof RagIndexingFailedError) {
          throw error;
        }
        consecutiveReadFailures += 1;
        setStatusStep('2/4 Reconectando ao acompanhamento da indexação...');
        setBatchInfo(
          `Não foi possível consultar o progresso (${consecutiveReadFailures} tentativa${consecutiveReadFailures === 1 ? '' : 's'}). Tentando novamente...`,
        );
      }

      await wait(RAG_STATUS_POLL_INTERVAL_MS);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const isCsv = selected.name.toLowerCase().endsWith('.csv')
      || CSV_CONTENT_TYPES.includes(selected.type);

    if (!isCsv) {
      setFile(null);
      setResult({ success: false, message: 'Selecione um arquivo no formato CSV.' });
      e.target.value = '';
      return;
    }

    if (selected.size > MAX_FILE_SIZE) {
      setFile(null);
      setResult({ success: false, message: 'O arquivo excede o tamanho máximo de 5 MB.' });
      e.target.value = '';
      return;
    }

    setFile(selected);
    setResult(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setIsLoading(true);
    setPhase('UPLOADING');
    setResult(null);
    setProgress(10);
    setStatusStep('1/4 Lendo arquivo e importando transações...');
    setBatchInfo('Enviando dados do arquivo CSV...');

    try {
      // 1. Upload CSV
      const { sourceId, importedCount, categorizedCount } = await transactionService.importCsv(file);

      setPhase('INDEXING');
      setProgress(INDEXING_PROGRESS_START);
      setStatusStep('2/4 Aguardando processamento da fila de indexação...');
      setBatchInfo('Consultando documentos pendentes desta importação...');

      await waitForRagIndexing(sourceId);

      setPhase('ANALYZING');
      setProgress(85);
      setStatusStep('3/4 Gerando diagnóstico financeiro e perfil IA...');
      setBatchInfo(`${importedCount} transações salvas e vetorizadas; preparando o perfil financeiro.`);

      // 3. Generate Analysis
      const analysis = await analysisService.analyzeStoredTransactions(
        model,
        'CSV_IMPORT',
        undefined,
        sourceId,
      );

      setProgress(100);
      setPhase('COMPLETED');
      setStatusStep('4/4 Sucesso! Redirecionando para o painel de análise...');
      rememberTransactionSource('CSV_IMPORT');

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['analyses'] }),
        queryClient.invalidateQueries({ queryKey: ['import-sources'] }),
      ]);

      setResult({
        success: true,
        message: `${importedCount} transações importadas, ${categorizedCount} categorizadas e a indexação vetorial foi concluída.`,
      });
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';

      setTimeout(() => {
        navigate(`/analyses/${analysis.id}`);
      }, 700);
    } catch (err) {
      setProgress(0);
      setPhase('IDLE');
      setStatusStep('');
      setBatchInfo('');
      setResult({
        success: false,
        message: toAccessibleImportErrorMessage(extractErrorMessage(err)),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-none space-y-4 sm:space-y-6">
      <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">Importar transações</h1>
          <p className="text-sm text-slate-500 sm:text-base">Escolha CSV ou conecte sua instituição pelo Open Finance</p>
        </div>
        <div className="grid gap-2 min-[420px]:grid-cols-2 xl:shrink-0">
          <Link to="/import/sources">
            <Button variant="outline" className="w-full whitespace-nowrap">
              <Database className="mr-2 h-4 w-4" />
              Ver fontes
            </Button>
          </Link>
          <Link to="/open-finance">
            <Button variant="outline" className="w-full whitespace-nowrap">
              <Landmark className="mr-2 h-4 w-4" />
              Conectar Open Finance
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload de Arquivo</CardTitle>
          <CardDescription>O arquivo deve conter as colunas: descrição, valor, data e tipo</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Modelo para analisar após a importação</label>
              <Select
                value={model}
                onChange={(event) => setModel(event.target.value as ProfileAnalysisModel)}
                options={[
                  { value: 'MACHINE_LEARNING', label: 'Machine Learning' },
                  { value: 'FINANCIAL_RULES', label: 'Regras financeiras' },
                ]}
              />
            </div>
            <div
              onClick={() => !isLoading && inputRef.current?.click()}
              className={cn(
                'flex min-h-44 flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 text-center transition-colors sm:p-8',
                isLoading
                  ? resolvedTheme === 'dark'
                    ? 'cursor-not-allowed border-white/10 bg-white/5 opacity-60'
                    : 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60'
                  : resolvedTheme === 'dark'
                    ? 'cursor-pointer border-cyan-300/20 bg-[rgba(255,255,255,0.04)] hover:border-cyan-300/40 hover:bg-[rgba(34,211,238,0.08)] active:bg-[rgba(34,211,238,0.12)]'
                    : 'cursor-pointer border-slate-300 bg-slate-50 hover:border-primary-400 hover:bg-primary-50 active:bg-primary-50'
              )}
            >
              {file ? (
                <FileCheck className={cn('h-10 w-10', resolvedTheme === 'dark' ? 'text-cyan-200' : 'text-primary-600')} />
              ) : (
                <Upload className={cn('h-10 w-10', resolvedTheme === 'dark' ? 'text-slate-300' : 'text-slate-400')} />
              )}
              <p className={cn('mt-3 text-sm font-medium', resolvedTheme === 'dark' ? 'text-white' : 'text-slate-700')}>
                {file ? file.name : 'Clique para selecionar o arquivo CSV'}
              </p>
              <p className={cn('text-xs', resolvedTheme === 'dark' ? 'text-slate-300' : 'text-slate-500')}>Arquivos .csv de até 5 MB</p>
              <input ref={inputRef} type="file" accept=".csv" disabled={isLoading} className="hidden" onChange={handleFileChange} />
            </div>

            {isLoading && (
              <div className="space-y-3 rounded-xl border border-primary-200 bg-primary-50/80 p-4 transition-all shadow-sm">
                <div className="flex items-center justify-between text-xs font-semibold text-primary-900">
                  <div className="flex items-center gap-2">
                    <Spinner size="sm" className="text-primary-600" />
                    <span>{statusStep}</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-primary-700">{progress}%</span>
                </div>
                
                {/* Progress bar line */}
                <div className="h-3 w-full overflow-hidden rounded-full bg-primary-200/80 p-0.5">
                  <div
                    role="progressbar"
                    aria-label="Progresso da importação e indexação"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress}
                    className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-700 transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-primary-800">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Layers className="h-3.5 w-3.5 shrink-0 text-primary-600" />
                    <span>{batchInfo}</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono text-[10px] text-primary-600">
                    <Cpu className="h-3 w-3 text-primary-500" />
                    <span>pgvector 1536d</span>
                  </div>
                </div>
              </div>
            )}

            {result && (
              <Alert variant={result.success ? 'success' : 'danger'}>
                {result.success ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5" />}
                <AlertTitle>{result.success ? 'Sucesso' : 'Erro'}</AlertTitle>
                <AlertDescription>{result.message}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={!file || isLoading} isLoading={isLoading}>
              {isLoading ? <Spinner size="sm" className="mr-2" /> : <Upload className="mr-2 h-4 w-4" />}
              {isLoading
                ? {
                    UPLOADING: 'Importando transações...',
                    INDEXING: 'Indexando e vetorizando no pgvector...',
                    ANALYZING: 'Gerando análise financeira...',
                    COMPLETED: 'Finalizando...',
                    IDLE: 'Importar e analisar',
                  }[phase]
                : 'Importar e analisar'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Formato Esperado</CardTitle>
        </CardHeader>
        <CardContent>
          <code className="block rounded-xl bg-slate-900 p-4 text-xs leading-6 text-[rgb(241,245,249)] sm:p-5 sm:text-sm">
            description,amount,date,type
            <br />
            Salário,5000,2026-06-01,INCOME
            <br />
            Supermercado,800,2026-06-05,EXPENSE
          </code>
        </CardContent>
      </Card>
    </div>
  );
}
