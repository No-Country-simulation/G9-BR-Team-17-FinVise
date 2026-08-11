import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  Check,
  CheckCircle2,
  Database,
  FileCheck2,
  FileSpreadsheet,
  Landmark,
  LoaderCircle,
  Scale,
  Upload,
  X,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { useTheme } from '@/components/auth/useTheme';
import { rememberTransactionSource } from '@/hooks/useTransactionSource';
import { analysisService } from '@/services/analysisService';
import { transactionService } from '@/services/transactionService';
import { extractErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ProfileAnalysisModel } from '@/types/analysis';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_FILES_PER_BATCH = 10;
const CSV_CONTENT_TYPES = ['text/csv', 'application/csv', 'application/vnd.ms-excel'];
const RAG_STATUS_POLL_INTERVAL_MS = 1000;
const UPLOAD_PROGRESS_START = 5;
const UPLOAD_PROGRESS_RANGE = 25;
const INDEXING_PROGRESS_START = 30;
const INDEXING_PROGRESS_RANGE = 50;

type ImportPhase = 'IDLE' | 'UPLOADING' | 'INDEXING' | 'ANALYZING' | 'COMPLETED';

class RagIndexingFailedError extends Error {}

function toAccessibleImportErrorMessage(rawMessage: string): string {
  const normalized = rawMessage.toLowerCase();

  if (
    normalized.includes('rollback-only')
    || normalized.includes('silently rolled back')
    || normalized.includes('transaction rolled back')
  ) {
    return 'Não foi possível concluir a importação devido a uma inconsistência temporária. Tente novamente em alguns instantes.';
  }

  if (
    normalized.includes('network')
    || normalized.includes('failed to fetch')
    || normalized.includes('timeout')
    || normalized.includes('ecconnaborted')
  ) {
    return 'A conexão foi interrompida durante a importação. Verifique sua rede e tente novamente.';
  }

  if (normalized.includes('payload too large') || normalized.includes('413')) {
    return 'O arquivo é maior que o limite permitido. Selecione um CSV de até 5 MB.';
  }

  return rawMessage;
}

const wait = (milliseconds: number) => new Promise((resolve) => {
  window.setTimeout(resolve, milliseconds);
});

const modelOptions: Array<{
  code: ProfileAnalysisModel;
  name: string;
  description: string;
  icon: typeof BrainCircuit;
}> = [
  {
    code: 'MACHINE_LEARNING',
    name: 'Machine Learning',
    description: 'Mais completo para identificar padrões de comportamento.',
    icon: BrainCircuit,
  },
  {
    code: 'FINANCIAL_RULES',
    name: 'Regras financeiras',
    description: 'Mais direto, conservador e fácil de explicar.',
    icon: Scale,
  },
];

export function ImportCsvPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusStep, setStatusStep] = useState('');
  const [statusDetail, setStatusDetail] = useState('');
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [model, setModel] = useState<ProfileAnalysisModel>('MACHINE_LEARNING');
  const [phase, setPhase] = useState<ImportPhase>('IDLE');
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const updateIndexingProgress = (
    indexedDocuments: number,
    totalDocuments: number,
    fileIndex: number,
    totalFiles: number,
  ) => {
    const indexingRatio = totalDocuments > 0
      ? Math.min(1, indexedDocuments / totalDocuments)
      : 0;
    const batchRatio = (fileIndex + indexingRatio) / totalFiles;
    setProgress(Math.min(
      80,
      INDEXING_PROGRESS_START + Math.floor(batchRatio * INDEXING_PROGRESS_RANGE),
    ));
    setStatusDetail('Estamos organizando as informações para gerar recomendações personalizadas.');
  };

  const waitForRagIndexing = async (
    sourceId: string,
    fileIndex: number,
    totalFiles: number,
    fileName: string,
  ) => {
    let consecutiveReadFailures = 0;
    let indexingFinished = false;

    while (!indexingFinished) {
      try {
        const status = await transactionService.getRagIndexStatus(sourceId);

        updateIndexingProgress(status.indexedDocuments, status.totalDocuments, fileIndex, totalFiles);
        consecutiveReadFailures = 0;

        if (status.status === 'COMPLETE' || status.status === 'EMPTY') {
          setProgress(
            INDEXING_PROGRESS_START
            + Math.floor(((fileIndex + 1) / totalFiles) * INDEXING_PROGRESS_RANGE),
          );
          setStatusStep(`Arquivo ${fileIndex + 1} de ${totalFiles} preparado`);
          setStatusDetail(`${fileName} foi importado e preparado com segurança.`);
          indexingFinished = true;
          break;
        }

        if (status.failedDocuments > 0) {
          const queue = await transactionService.getRagIndexQueueStatus();
          if (queue.status === 'DEAD_LETTER') {
            throw new RagIndexingFailedError(
              'Não foi possível preparar todos os dados. Aguarde alguns instantes e tente importar novamente.',
            );
          }
          if (queue.status === 'COMPLETED' || queue.status === 'EMPTY') {
            throw new RagIndexingFailedError(
              'Alguns dados não puderam ser preparados. Tente novamente para concluir a importação.',
            );
          }
          setStatusStep('Finalizando a preparação dos dados');
          setStatusDetail('Essa etapa está levando um pouco mais de tempo, mas continua em andamento.');
        } else if (status.status === 'PROCESSING') {
          setStatusStep('Preparando seus dados');
          setStatusDetail('Estamos organizando as informações para gerar recomendações personalizadas.');
        } else {
          setStatusStep('Aguardando o processamento');
          setStatusDetail('Seu arquivo já foi recebido e será processado em seguida.');
        }
      } catch (error) {
        if (error instanceof RagIndexingFailedError) throw error;
        consecutiveReadFailures += 1;
        setStatusStep('Reconectando ao processamento');
        setStatusDetail(
          consecutiveReadFailures === 1
            ? 'A conexão oscilou. Tentaremos novamente automaticamente.'
            : `Tentativa de reconexão ${consecutiveReadFailures}. Seus dados permanecem seguros.`,
        );
      }

      await wait(RAG_STATUS_POLL_INTERVAL_MS);
    }
  };

  const addFiles = (selectedFiles: File[]) => {
    const currentKeys = new Set(files.map(fileKey));
    const accepted: File[] = [];
    const rejected: string[] = [];

    for (const selected of selectedFiles) {
      const isCsv = selected.name.toLowerCase().endsWith('.csv')
        || CSV_CONTENT_TYPES.includes(selected.type);

      if (!isCsv) {
        rejected.push(`${selected.name}: formato inválido`);
        continue;
      }
      if (selected.size > MAX_FILE_SIZE) {
        rejected.push(`${selected.name}: excede 5 MB`);
        continue;
      }
      if (currentKeys.has(fileKey(selected)) || accepted.some((file) => fileKey(file) === fileKey(selected))) {
        continue;
      }
      if (files.length + accepted.length >= MAX_FILES_PER_BATCH) {
        rejected.push(`o lote aceita até ${MAX_FILES_PER_BATCH} arquivos`);
        break;
      }
      accepted.push(selected);
    }

    if (accepted.length > 0) {
      setFiles((current) => [...current, ...accepted]);
      setPhase('IDLE');
    }
    setResult(rejected.length > 0
      ? { success: false, message: `Alguns arquivos não foram adicionados: ${rejected.join('; ')}.` }
      : null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files ?? []));
  };

  const removeFile = (index: number) => {
    setFiles((current) => current.filter((_, currentIndex) => currentIndex !== index));
    setResult(null);
  };

  const clearFiles = () => {
    setFiles([]);
    setResult(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (files.length === 0) return;

    setIsLoading(true);
    setPhase('UPLOADING');
    setResult(null);
    setProgress(UPLOAD_PROGRESS_START);
    setStatusStep(`Importando arquivo 1 de ${files.length}`);
    setStatusDetail('Estamos validando e salvando o primeiro arquivo do lote.');

    let completedFiles = 0;

    try {
      const importedSources: Array<{ sourceId: string; fileName: string }> = [];
      let importedCount = 0;
      let categorizedCount = 0;

      for (const [index, currentFile] of files.entries()) {
        setStatusStep(`Importando arquivo ${index + 1} de ${files.length}`);
        setStatusDetail(`Validando e salvando ${currentFile.name}.`);

        const imported = await transactionService.importCsv(currentFile);
        importedSources.push({ sourceId: imported.sourceId, fileName: currentFile.name });
        importedCount += imported.importedCount;
        categorizedCount += imported.categorizedCount;
        completedFiles = index + 1;
        setProgress(
          UPLOAD_PROGRESS_START
          + Math.floor(((index + 1) / files.length) * UPLOAD_PROGRESS_RANGE),
        );
      }

      setPhase('INDEXING');
      for (const [index, importedSource] of importedSources.entries()) {
        setStatusStep(`Preparando arquivo ${index + 1} de ${files.length}`);
        setStatusDetail('Essa etapa pode levar alguns minutos em arquivos maiores.');

        await waitForRagIndexing(
          importedSource.sourceId,
          index,
          files.length,
          importedSource.fileName,
        );
      }

      setPhase('ANALYZING');
      setProgress(85);
      setStatusStep('Criando a análise consolidada');
      setStatusDetail(`${importedCount.toLocaleString('pt-BR')} transações de ${files.length} arquivo${files.length > 1 ? 's' : ''} foram importadas.`);

      const analysis = await analysisService.analyzeStoredTransactions(
        model,
        'CSV_IMPORT',
        undefined,
        undefined,
        importedSources.map((source) => source.sourceId),
      );

      setProgress(100);
      setPhase('COMPLETED');
      setStatusStep('Sua análise está pronta');
      setStatusDetail('Abrindo o resultado completo...');
      rememberTransactionSource('CSV_IMPORT');

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['analyses'] }),
        queryClient.invalidateQueries({ queryKey: ['import-sources'] }),
      ]);

      setResult({
        success: true,
        message: `${files.length} arquivo${files.length > 1 ? 's' : ''}, ${importedCount.toLocaleString('pt-BR')} transações importadas e ${categorizedCount.toLocaleString('pt-BR')} categorizadas.`,
      });

      navigate(`/analyses/${analysis.id}`);
    } catch (err) {
      setProgress(0);
      setPhase('IDLE');
      setStatusStep('');
      setStatusDetail('');
      setResult({
        success: false,
        message: `${completedFiles > 0 ? `${completedFiles} de ${files.length} arquivos foram importados antes da interrupção. ` : ''}${toAccessibleImportErrorMessage(extractErrorMessage(err))}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const currentFlowStep = files.length === 0 ? 1 : phase === 'ANALYZING' || phase === 'COMPLETED' ? 3 : 2;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-cyan-700">
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
            Importação por arquivo
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Importar arquivos CSV</h1>
          <p className="mt-1 text-sm leading-6 text-slate-500 sm:text-base">
            Envie um ou vários arquivos e receba uma análise financeira consolidada.
          </p>
        </div>
        <Link
          to="/import/sources"
          className="inline-flex min-h-10 items-center text-sm font-semibold text-cyan-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        >
          <Database className="mr-2 h-4 w-4" aria-hidden="true" />
          Gerenciar fontes importadas
        </Link>
      </header>

      <ol className="grid grid-cols-3 gap-2" aria-label="Etapas da importação">
        <FlowStep number={1} label="Arquivos" current={currentFlowStep} />
        <FlowStep number={2} label="Preparação" current={currentFlowStep} />
        <FlowStep number={3} label="Resultado" current={currentFlowStep} />
      </ol>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-stretch">
        <Card className="flex h-full flex-col">
          <CardHeader>
            <CardTitle>{isLoading ? 'Processando sua importação' : files.length > 0 ? 'Revise antes de continuar' : 'Selecione seus arquivos'}</CardTitle>
            <CardDescription>
              {isLoading
                ? 'Você pode acompanhar o progresso sem precisar atualizar a página.'
                : files.length > 0
                  ? 'Confirme o lote e escolha como deseja gerar a análise.'
                  : `Envie até ${MAX_FILES_PER_BATCH} arquivos CSV de no máximo 5 MB cada.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1">
            <form onSubmit={handleSubmit} className="flex w-full flex-1 flex-col gap-5">
              <input
                id="transaction-csv-file"
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                multiple
                disabled={isLoading}
                className="sr-only"
                onChange={handleFileChange}
              />

              {files.length === 0 ? (
                <label
                  htmlFor="transaction-csv-file"
                  onDragEnter={() => setIsDragging(true)}
                  onDragLeave={() => setIsDragging(false)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsDragging(false);
                    addFiles(Array.from(event.dataTransfer.files ?? []));
                  }}
                  className={cn(
                    'flex min-h-60 flex-1 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all focus-within:outline-none focus-within:ring-2 focus-within:ring-cyan-400 sm:p-8',
                    isDragging
                      ? 'scale-[0.995] border-cyan-500 bg-[rgba(7,141,162,0.10)]'
                      : resolvedTheme === 'dark'
                        ? 'border-cyan-300/20 bg-white/5 hover:border-cyan-300/40 hover:bg-cyan-300/5'
                        : 'border-slate-300 bg-slate-50/70 hover:border-cyan-500 hover:bg-[rgba(7,141,162,0.06)]'
                  )}
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgba(7,141,162,0.12)] text-cyan-700">
                    <Upload className="h-7 w-7" aria-hidden="true" />
                  </div>
                  <p className="mt-4 font-semibold text-slate-900">Arraste seus CSVs para cá</p>
                  <p className="mt-1 text-sm text-slate-500">ou clique para selecionar um ou vários arquivos</p>
                  <span className="mt-4 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    Até {MAX_FILES_PER_BATCH} CSVs · 5 MB por arquivo
                  </span>
                </label>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {files.length} arquivo{files.length > 1 ? 's' : ''} no lote
                    </p>
                    {!isLoading && (
                      <div className="flex items-center gap-1">
                        {files.length < MAX_FILES_PER_BATCH && (
                          <button
                            type="button"
                            onClick={() => inputRef.current?.click()}
                            className="rounded-lg px-2.5 py-2 text-xs font-semibold text-cyan-700 hover:bg-[rgba(7,141,162,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                          >
                            Adicionar arquivos
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={clearFiles}
                          className="rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                        >
                          Limpar lote
                        </button>
                      </div>
                    )}
                  </div>
                  <ul className="max-h-60 space-y-2 overflow-y-auto pr-1" aria-label="Arquivos selecionados">
                    {files.map((file, index) => (
                      <li key={fileKey(file)} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                          <FileCheck2 className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900" title={file.name}>{file.name}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{formatFileSize(file.size)} · pronto para importar</p>
                        </div>
                        {!isLoading && (
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                            aria-label={`Remover ${file.name}`}
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result && (
                <Alert variant={result.success ? 'success' : 'danger'}>
                  {result.success
                    ? <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                    : <AlertTriangle className="h-5 w-5" aria-hidden="true" />}
                  <AlertTitle>{result.success ? 'Importação concluída' : 'Não foi possível importar'}</AlertTitle>
                  <AlertDescription>{result.message}</AlertDescription>
                </Alert>
              )}

              {files.length > 0 && !isLoading && (
                <fieldset>
                  <legend className="text-sm font-semibold text-slate-900">Como deseja analisar os dados?</legend>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Você poderá gerar outra análise depois, sem importar o arquivo novamente.</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {modelOptions.map((option) => {
                      const Icon = option.icon;
                      const selected = model === option.code;
                      return (
                        <button
                          key={option.code}
                          type="button"
                          onClick={() => setModel(option.code)}
                          className={cn(
                            'relative rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400',
                            selected ? 'border-cyan-500 bg-[rgba(7,141,162,0.10)]' : 'border-slate-200 bg-white/40 hover:border-cyan-300'
                          )}
                          aria-pressed={selected}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <Icon className={cn('h-5 w-5', selected ? 'text-cyan-700' : 'text-slate-500')} aria-hidden="true" />
                            {selected && (
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#078da2] text-white">
                                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                              </span>
                            )}
                          </div>
                          <p className="mt-3 text-sm font-semibold text-slate-900">{option.name}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">{option.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              {isLoading && (
                <ImportProgress phase={phase} progress={progress} title={statusStep} detail={statusDetail} />
              )}

              {files.length > 0 && !isLoading && (
                <Button type="submit" className="w-full" size="lg">
                  Importar {files.length} arquivo{files.length > 1 ? 's' : ''} e gerar análise
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <Card className="rounded-[22px]">
            <CardHeader>
              <CardTitle className="text-base">Antes de começar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <ul className="space-y-3 text-slate-600">
                <GuideItem>Uma transação por linha.</GuideItem>
                <GuideItem>Datas no formato AAAA-MM-DD.</GuideItem>
                <GuideItem>Tipos aceitos: INCOME e EXPENSE.</GuideItem>
                <GuideItem>Até {MAX_FILES_PER_BATCH} arquivos por lote.</GuideItem>
                <GuideItem>Cada arquivo pode ter no máximo 5 MB.</GuideItem>
              </ul>

              <details className="group rounded-xl border border-slate-200 bg-slate-50/60">
                <summary className="cursor-pointer list-none px-3 py-3 text-sm font-semibold text-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
                  Ver exemplo do CSV
                </summary>
                <div className="border-t border-slate-200 p-3">
                  <code className="block overflow-x-auto whitespace-pre text-[11px] leading-5 text-slate-700">{`description,amount,date,type
Salário,5000,2026-06-01,INCOME
Mercado,800,2026-06-05,EXPENSE`}</code>
                </div>
              </details>
            </CardContent>
          </Card>

          <Card className="rounded-[22px]">
            <CardContent className="p-4 sm:p-5">
              <Landmark className="h-5 w-5 text-cyan-700" aria-hidden="true" />
              <h2 className="mt-3 font-semibold text-slate-900">Prefere conectar seu banco?</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">Use o Open Finance e sincronize as transações sem arquivo.</p>
              <Link
                to="/open-finance"
                className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-cyan-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                Conectar Open Finance
                <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
              </Link>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function FlowStep({ number, label, current }: { number: number; label: string; current: number }) {
  const completed = number < current;
  const active = number === current;
  return (
    <li className={cn(
      'flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-xs font-semibold sm:px-4 sm:text-sm',
      completed || active
        ? 'border-cyan-300/60 bg-[rgba(7,141,162,0.08)] text-cyan-700'
        : 'border-slate-200 bg-white/40 text-slate-400'
    )}>
      <span className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px]',
        completed || active ? 'bg-[#078da2] text-white' : 'bg-slate-100 text-slate-500'
      )}>
        {completed ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : number}
      </span>
      <span className="truncate">{label}</span>
    </li>
  );
}

function ImportProgress({ phase, progress, title, detail }: {
  phase: ImportPhase;
  progress: number;
  title: string;
  detail: string;
}) {
  const stages = [
    { phase: 'UPLOADING', label: 'Importando arquivo' },
    { phase: 'INDEXING', label: 'Preparando dados' },
    { phase: 'ANALYZING', label: 'Gerando análise' },
  ] as const;
  const phaseOrder: Record<ImportPhase, number> = {
    IDLE: 0,
    UPLOADING: 1,
    INDEXING: 2,
    ANALYZING: 3,
    COMPLETED: 4,
  };

  return (
    <div className="rounded-2xl border border-cyan-300/50 bg-[rgba(7,141,162,0.08)] p-4 sm:p-5" role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        {phase === 'COMPLETED'
          ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
          : <LoaderCircle className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-cyan-700 motion-reduce:animate-none" aria-hidden="true" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-slate-900">{title}</p>
            <span className="text-xs font-bold tabular-nums text-cyan-700">{progress}%</span>
          </div>
          <p className="mt-1 text-sm leading-5 text-slate-500">{detail}</p>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[rgba(7,141,162,0.14)]">
        <div
          role="progressbar"
          aria-label="Progresso da importação"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="h-full rounded-full bg-[#078da2] transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <ol className="mt-4 grid grid-cols-3 gap-2">
        {stages.map((stage, index) => {
          const completed = phaseOrder[phase] > index + 1;
          const active = phaseOrder[phase] === index + 1;
          return (
            <li key={stage.phase} className={cn('text-center text-[10px] font-medium sm:text-xs', completed || active ? 'text-cyan-700' : 'text-slate-400')}>
              <span className={cn('mx-auto mb-1 flex h-5 w-5 items-center justify-center rounded-full border', completed ? 'border-[#078da2] bg-[#078da2] text-white' : active ? 'border-[#078da2] bg-[#078da2] text-white' : 'border-slate-300 bg-white text-slate-400')}>
                {completed ? <Check className="h-3 w-3" aria-hidden="true" /> : index + 1}
              </span>
              {stage.label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function GuideItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} bytes`;
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}
