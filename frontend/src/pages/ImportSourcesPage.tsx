import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Files,
  Landmark,
  Plus,
  RefreshCw,
  Star,
  Trash2,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ImportSourcesSkeleton } from '@/components/skeletons/PageSkeletons';
import {
  ImportSource,
  ImportSourceType,
  importSourceService,
} from '@/services/importSourceService';
import { extractErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { analysisService } from '@/services/analysisService';

type SourceFilter = 'ALL' | ImportSourceType;

const filters: Array<{ value: SourceFilter; label: string }> = [
  { value: 'ALL', label: 'Todas' },
  { value: 'CSV', label: 'Arquivos CSV' },
  { value: 'OPEN_FINANCE', label: 'Open Finance' },
];

function formatDate(value: string | null) {
  if (!value) return 'Ainda não sincronizada';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatFileSize(bytes: number | null) {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(status: string, hasWarning = false) {
  if (status === 'COMPLETED' && hasWarning) return 'Indexado com avisos';
  switch (status) {
    case 'COMPLETED': return 'Indexado';
    case 'CONNECTED': return 'Conectada';
    case 'PROCESSING': return 'Processando';
    case 'FAILED': return 'Falhou';
    default: return status;
  }
}

function statusVariant(status: string, hasWarning = false): 'success' | 'warning' | 'danger' | 'outline' {
  if (status === 'COMPLETED' && hasWarning) return 'warning';
  if (status === 'COMPLETED' || status === 'CONNECTED') return 'success';
  if (status === 'FAILED') return 'danger';
  if (status === 'PROCESSING' || status === 'PENDING') return 'warning';
  return 'outline';
}

function SourceIdentity({ source }: { source: ImportSource }) {
  const Icon = source.type === 'CSV' ? FileSpreadsheet : Landmark;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
        source.type === 'CSV'
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-primary-50 text-primary-700',
      )}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate font-semibold text-slate-900" title={source.displayName}>
            {source.displayName}
          </p>
          {source.defaultSource && (
            <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500" aria-label="Fonte padrão" />
          )}
        </div>
        <p className="text-xs text-slate-500">
          {source.type === 'CSV' ? formatFileSize(source.sizeBytes) : source.provider || 'Open Finance'}
        </p>
        {source.errorMessage && (
          <p className="mt-1 max-w-xs truncate text-xs text-amber-700" title={source.errorMessage}>
            Algumas linhas não foram importadas
          </p>
        )}
      </div>
    </div>
  );
}

export function ImportSourcesPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<SourceFilter>('ALL');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'warning'; message: string } | null>(null);
  const [sourcePendingDelete, setSourcePendingDelete] = useState<ImportSource | null>(null);
  const { data = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['import-sources'],
    queryFn: importSourceService.getAll,
  });

  const visibleSources = useMemo(
    () => filter === 'ALL' ? data : data.filter((source) => source.type === filter),
    [data, filter],
  );
  const csvCount = data.filter((source) => source.type === 'CSV').length;
  const openFinanceCount = data.filter((source) => source.type === 'OPEN_FINANCE').length;
  const transactionCount = data.reduce((total, source) => total + source.transactionCount, 0);

  const refreshData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['import-sources'] }),
      queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      queryClient.invalidateQueries({ queryKey: ['analyses'] }),
    ]);
  };

  const defaultMutation = useMutation({
    mutationFn: async (source: ImportSource) => {
      await importSourceService.setDefault(source);
      try {
        await analysisService.analyzeStoredTransactions(
          'MACHINE_LEARNING',
          source.type === 'CSV' ? 'CSV_IMPORT' : 'OPEN_FINANCE_PLUGGY',
          undefined,
          source.id,
        );
        return { warning: false };
      } catch {
        return { warning: true };
      }
    },
    onSuccess: async ({ warning }, source) => {
      await refreshData();
      setFeedback({
        type: warning ? 'warning' : 'success',
        message: warning
          ? `${source.displayName} foi definida como padrão, mas não foi possível gerar um novo perfil para essa fonte.`
          : `${source.displayName} agora é a fonte padrão do Dashboard.`,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (source: ImportSource) => importSourceService.delete(source),
    onSuccess: async (_, source) => {
      await refreshData();
      setSourcePendingDelete(null);
      setFeedback({ type: 'success', message: `${source.displayName} foi excluída com suas transações indexadas.` });
    },
  });

  const handleDelete = (source: ImportSource) => {
    setSourcePendingDelete(source);
  };

  const closeDeleteModal = () => {
    if (!deleteMutation.isPending) {
      setSourcePendingDelete(null);
    }
  };

  const confirmDelete = () => {
    if (sourcePendingDelete) {
      deleteMutation.mutate(sourcePendingDelete);
    }
  };

  useEffect(() => {
    if (!sourcePendingDelete) return;

    const previousOverflow = document.body.style.overflow;
    const previousOverscrollBehavior = document.body.style.overscrollBehavior;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deleteMutation.isPending) {
        setSourcePendingDelete(null);
      }
    };

    const preventScroll = (event: Event) => {
      event.preventDefault();
    };

    const preventScrollKeys = (event: KeyboardEvent) => {
      const blockedKeys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar'];
      if (blockedKeys.includes(event.key)) {
        event.preventDefault();
      }
    };

    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('keydown', preventScrollKeys, { passive: false });
    window.addEventListener('wheel', preventScroll, { passive: false });
    window.addEventListener('touchmove', preventScroll, { passive: false });

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscrollBehavior;
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('keydown', preventScrollKeys);
      window.removeEventListener('wheel', preventScroll);
      window.removeEventListener('touchmove', preventScroll);
    };
  }, [sourcePendingDelete, deleteMutation.isPending]);

  if (isLoading) return <ImportSourcesSkeleton />;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">Fontes importadas</h1>
          <p className="mt-1 text-sm text-slate-500 sm:text-base">
            Acompanhe os arquivos e as contas que alimentam suas análises.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')} />
            Atualizar
          </Button>
          <Link
            to="/import"
            className="inline-flex h-14 w-full items-center justify-center rounded-[14px] bg-[linear-gradient(180deg,#5fe6ea_0%,#2fcbd7_100%)] px-5 py-2 text-[16px] font-semibold tracking-tight text-slate-950 shadow-[0_12px_30px_rgba(45,212,191,0.20)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(45,212,191,0.24)] focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <Plus className="mr-2 h-4 w-4" />Nova importação
          </Link>
        </div>
      </div>

      {isError && (
        <Alert variant="danger">
          <AlertTitle>Não foi possível carregar as fontes</AlertTitle>
          <AlertDescription>{extractErrorMessage(error)}</AlertDescription>
        </Alert>
      )}

      {(defaultMutation.isError || deleteMutation.isError) && (
        <Alert variant="danger">
          <AlertTitle>Não foi possível concluir a ação</AlertTitle>
          <AlertDescription>
            {extractErrorMessage(defaultMutation.error || deleteMutation.error)}
          </AlertDescription>
        </Alert>
      )}

      {feedback && (
        <Alert variant={feedback.type === 'success' ? 'success' : 'warning'}>
          <AlertTitle>{feedback.type === 'success' ? 'Concluído' : 'Atenção'}</AlertTitle>
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {[
          { label: 'Fontes cadastradas', value: data.length, icon: Database, color: 'text-slate-700 bg-slate-100' },
          { label: 'Arquivos CSV', value: csvCount, icon: FileSpreadsheet, color: 'text-emerald-700 bg-emerald-50' },
          { label: 'Contas conectadas', value: openFinanceCount, icon: Landmark, color: 'text-primary-700 bg-primary-50' },
          { label: 'Transações indexadas', value: transactionCount.toLocaleString('pt-BR'), icon: CheckCircle2, color: 'text-violet-700 bg-violet-50' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="relative">
            <CardContent className="min-h-28 p-4 sm:p-5 xl:flex xl:items-center xl:justify-between">
              <div className="min-w-0 pr-9 xl:pr-2">
                <p className="text-xs leading-4 text-slate-500 sm:text-sm">{label}</p>
                <p className="mt-1 truncate text-xl font-bold tabular-nums text-slate-900 sm:text-2xl" title={String(value)}>{value}</p>
              </div>
              <div className={cn('absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl sm:right-4 sm:top-4 xl:static xl:h-11 xl:w-11', color)}>
                <Icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-white p-1.5 sm:flex sm:overflow-x-auto" role="tablist">
        {filters.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={filter === option.value}
            onClick={() => setFilter(option.value)}
            className={cn(
              'min-h-11 min-w-0 truncate rounded-lg px-1.5 py-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:shrink-0 sm:px-4 sm:text-sm',
              filter === option.value
                ? 'bg-primary-50 text-primary-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 focus-visible:bg-slate-50 focus-visible:text-slate-900',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {visibleSources.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Files}
              title="Nenhuma fonte encontrada"
              description="Importe um arquivo CSV ou conecte uma conta Open Finance para iniciar o controle."
              action={(
                <Link to="/import" className="inline-flex">
                  <Button><Plus className="mr-2 h-4 w-4" />Importar transações</Button>
                </Link>
              )}
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden overflow-x-auto xl:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-semibold">Arquivo ou conta</th>
                  <th className="px-4 py-3 font-semibold">Origem</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Transações</th>
                  <th className="px-6 py-3 font-semibold">Última atualização</th>
                  <th className="px-6 py-3 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleSources.map((source) => (
                  <tr key={source.id} className="hover:bg-slate-50/70">
                    <td className="max-w-sm px-6 py-4"><SourceIdentity source={source} /></td>
                    <td className="px-4 py-4 text-slate-600">
                      {source.type === 'CSV' ? 'Arquivo CSV' : 'Open Finance'}
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant={statusVariant(source.status, Boolean(source.errorMessage))}>
                        {statusLabel(source.status, Boolean(source.errorMessage))}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-right font-semibold text-slate-900">
                      {source.transactionCount.toLocaleString('pt-BR')}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-slate-600">
                      {formatDate(source.lastSyncAt || source.createdAt)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={source.defaultSource || defaultMutation.isPending || deleteMutation.isPending}
                          onClick={() => defaultMutation.mutate(source)}
                          title={source.defaultSource ? 'Fonte padrão atual' : 'Usar no Dashboard'}
                        >
                          <Star className={cn('mr-1.5 h-4 w-4', source.defaultSource && 'fill-amber-400 text-amber-500')} />
                          {source.defaultSource ? 'Padrão' : 'Definir padrão'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          disabled={defaultMutation.isPending || deleteMutation.isPending}
                          onClick={() => handleDelete(source)}
                          aria-label={`Excluir ${source.displayName}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-slate-100 xl:hidden">
            {visibleSources.map((source) => (
              <div key={source.id} className="space-y-4 p-4">
                <div className="flex flex-col gap-3 min-[360px]:flex-row min-[360px]:items-start min-[360px]:justify-between">
                  <SourceIdentity source={source} />
                  <Badge className="w-fit shrink-0" variant={statusVariant(source.status, Boolean(source.errorMessage))}>
                    {statusLabel(source.status, Boolean(source.errorMessage))}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Transações</p>
                    <p className="font-semibold text-slate-900">{source.transactionCount.toLocaleString('pt-BR')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Atualização</p>
                    <p className="font-medium text-slate-700">{formatDate(source.lastSyncAt || source.createdAt)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    disabled={source.defaultSource || defaultMutation.isPending || deleteMutation.isPending}
                    onClick={() => defaultMutation.mutate(source)}
                  >
                    <Star className={cn('mr-1.5 h-4 w-4', source.defaultSource && 'fill-amber-400 text-amber-500')} />
                    {source.defaultSource ? 'Fonte padrão' : 'Usar no Dashboard'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    disabled={defaultMutation.isPending || deleteMutation.isPending}
                    onClick={() => handleDelete(source)}
                    aria-label={`Excluir ${source.displayName}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {sourcePendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6">
          <button
            type="button"
            className="absolute inset-0"
            onClick={closeDeleteModal}
            aria-label="Fechar confirmação de exclusão"
          />
          <div className="relative w-full max-w-xl overflow-hidden rounded-[30px] border border-white/20 bg-[linear-gradient(180deg,rgba(8,15,28,0.98)_0%,rgba(5,12,25,0.97)_100%)] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.55)] sm:p-7">
            <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl" aria-hidden="true" />
            <div className="pointer-events-none absolute -bottom-20 -left-20 h-52 w-52 rounded-full bg-emerald-300/15 blur-3xl" aria-hidden="true" />

            <div className="relative flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-red-200/30 bg-red-500/20 text-red-100">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold tracking-tight text-slate-50">Confirmar exclusão</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-200">
                  Excluir <span className="font-semibold text-cyan-200">{sourcePendingDelete.displayName}</span> e{' '}
                  <span className="font-semibold text-cyan-200">
                    {sourcePendingDelete.transactionCount.toLocaleString('pt-BR')} transações indexadas
                  </span>
                  ? Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>

            <div className="relative mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={closeDeleteModal}
                disabled={deleteMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                className="w-full sm:w-auto"
                onClick={confirmDelete}
                isLoading={deleteMutation.isPending}
              >
                Excluir definitivamente
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
