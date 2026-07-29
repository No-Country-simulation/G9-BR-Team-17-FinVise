import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Upload, FileCheck, AlertTriangle, Landmark, Database, Cpu } from 'lucide-react';
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

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const CSV_CONTENT_TYPES = ['text/csv', 'application/csv', 'application/vnd.ms-excel'];

export function ImportCsvPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusStep, setStatusStep] = useState('');
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [model, setModel] = useState<ProfileAnalysisModel>('MACHINE_LEARNING');
  const inputRef = useRef<HTMLInputElement>(null);

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
    setResult(null);
    setProgress(15);
    setStatusStep('Lendo arquivo e validando estrutura CSV...');

    // Smooth progress bar simulation
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev < 40) {
          setStatusStep('Categorizando transações e enviando ao banco...');
          return prev + 5;
        }
        if (prev < 75) {
          setStatusStep('Gerando vetores & embeddings RAG (pgvector)...');
          return prev + 4;
        }
        if (prev < 90) {
          setStatusStep('Calculando análise financeira e perfil de IA...');
          return prev + 2;
        }
        return prev;
      });
    }, 350);

    try {
      const { sourceId, importedCount, categorizedCount } = await transactionService.importCsv(file);
      setProgress(85);
      setStatusStep('Gerando análise financeira executiva...');

      const analysis = await analysisService.analyzeStoredTransactions(
        model,
        'CSV_IMPORT',
        undefined,
        sourceId,
      );

      setProgress(100);
      setStatusStep('Concluído com sucesso! Redirecionando...');
      rememberTransactionSource('CSV_IMPORT');

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['analyses'] }),
        queryClient.invalidateQueries({ queryKey: ['import-sources'] }),
      ]);

      setResult({
        success: true,
        message: `${importedCount} transações importadas; ${categorizedCount} categorizadas automaticamente.`,
      });
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      clearInterval(timer);
      navigate(`/analyses/${analysis.id}`);
    } catch (err) {
      clearInterval(timer);
      setProgress(0);
      setStatusStep('');
      setResult({ success: false, message: extractErrorMessage(err) });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
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
              className={`flex min-h-44 flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 text-center transition-colors sm:p-8 ${
                isLoading
                  ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60'
                  : 'cursor-pointer border-slate-300 bg-slate-50 hover:border-primary-400 hover:bg-primary-50 active:bg-primary-50'
              }`}
            >
              {file ? <FileCheck className="h-10 w-10 text-primary-600" /> : <Upload className="h-10 w-10 text-slate-400" />}
              <p className="mt-3 text-sm font-medium text-slate-700">
                {file ? file.name : 'Clique para selecionar o arquivo CSV'}
              </p>
              <p className="text-xs text-slate-500">Arquivos .csv de até 5 MB</p>
              <input ref={inputRef} type="file" accept=".csv" disabled={isLoading} className="hidden" onChange={handleFileChange} />
            </div>

            {isLoading && (
              <div className="space-y-3 rounded-xl border border-primary-200 bg-primary-50/70 p-4 transition-all">
                <div className="flex items-center justify-between text-xs font-semibold text-primary-900">
                  <div className="flex items-center gap-2">
                    <Spinner size="sm" className="text-primary-600" />
                    <span>{statusStep}</span>
                  </div>
                  <span className="font-mono text-primary-700">{progress}%</span>
                </div>
                
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-primary-200/80">
                  <div
                    className="h-full bg-primary-600 transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-primary-700">
                  <Cpu className="h-3.5 w-3.5 shrink-0 text-primary-600" />
                  <span>Indexando transações e gerando embeddings RAG no PostgreSQL (pgvector) para a IA.</span>
                </div>
              </div>
            )}

            {result && (
              <Alert variant={result.success ? 'success' : 'danger'}>
                <AlertTriangle className="h-5 w-5" />
                <AlertTitle>{result.success ? 'Sucesso' : 'Erro'}</AlertTitle>
                <AlertDescription>{result.message}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={!file || isLoading} isLoading={isLoading}>
              {isLoading ? <Spinner size="sm" className="mr-2" /> : <Upload className="mr-2 h-4 w-4" />}
              {isLoading ? 'Importando e vetorizando...' : 'Importar e analisar'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Formato Esperado</CardTitle>
        </CardHeader>
        <CardContent>
          <code className="block rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
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
