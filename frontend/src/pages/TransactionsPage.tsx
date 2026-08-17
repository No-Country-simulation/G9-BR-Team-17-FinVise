import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, FileUp, Landmark, ReceiptText, SlidersHorizontal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TransactionTableSkeleton } from '@/components/skeletons/PageSkeletons';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/Alert';
import { formatCurrency, formatDate } from '@/lib/utils';
import { transactionService } from '@/services/transactionService';
import { useTransactionSource } from '@/hooks/useTransactionSource';
import { importSourceService } from '@/services/importSourceService';
import { TransactionSource } from '@/types/transaction';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTheme } from '@/components/auth/useTheme';
import { ImportSourceSelector } from '@/components/transactions/ImportSourceSelector';

function transactionSource(type: 'CSV' | 'OPEN_FINANCE'): TransactionSource {
  return type === 'CSV' ? 'CSV_IMPORT' : 'OPEN_FINANCE_PLUGGY';
}

const typeOptions = [
  { value: '', label: 'Todos os tipos' },
  { value: 'INCOME', label: 'Receita' },
  { value: 'EXPENSE', label: 'Despesa' },
];

const categoryOptions = [
  { value: '', label: 'Todas as categorias' },
  { value: 'ALIMENTACAO', label: 'Alimentação' },
  { value: 'TRANSPORTE', label: 'Transporte' },
  { value: 'SAUDE', label: 'Saúde' },
  { value: 'MORADIA', label: 'Moradia' },
  { value: 'EDUCACAO', label: 'Educação' },
  { value: 'LAZER', label: 'Lazer' },
  { value: 'SERVICOS', label: 'Serviços' },
  { value: 'COMPRAS', label: 'Compras' },
  { value: 'DIVIDAS', label: 'Dívidas' },
  { value: 'INVESTIMENTOS', label: 'Investimentos' },
  { value: 'TRANSFERENCIAS', label: 'Transferências' },
  { value: 'RENDA', label: 'Renda' },
  { value: 'OUTROS', label: 'Outros' },
];

const pageSizeOptions = [
  { value: '25', label: '25' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
];

interface TransactionFilters {
  type: string;
  category: string;
  startDate: string;
  endDate: string;
}

export function TransactionsPage() {
  const { resolvedTheme } = useTheme();
  const { source: rememberedSource, setSource } = useTransactionSource();
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const { data: importSources = [], isLoading: sourcesLoading } = useQuery({
    queryKey: ['import-sources'],
    queryFn: importSourceService.getAll,
  });
  const selectedImportSource = importSources.find((item) => item.id === selectedSourceId)
    || importSources.find((item) => item.defaultSource)
    || importSources[0]
    || null;
  const source = selectedImportSource
    ? transactionSource(selectedImportSource.type)
    : rememberedSource;
  const [filters, setFilters] = useState<TransactionFilters>({
    type: '',
    category: '',
    startDate: '',
    endDate: '',
  });
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['transactions', source, selectedImportSource?.id, filters, page, size],
    queryFn: () => transactionService.getAll({
      ...filters,
      source,
      importSourceId: selectedImportSource?.id,
      page,
      size,
    }),
    placeholderData: keepPreviousData,
    retry: false,
  });

  const transactions = data?.content ?? [];
  const totalElements = data?.totalElements ?? 0;
  const totalPages = data?.totalPages ?? 0;
  const currentPage = data?.number ?? page;
  const firstVisiblePage = Math.max(0, Math.min(currentPage - 2, Math.max(0, totalPages - 5)));
  const visiblePages = Array.from(
    { length: Math.min(5, totalPages) },
    (_, index) => firstVisiblePage + index,
  );

  const updateFilter = (name: keyof TransactionFilters, value: string) => {
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(0);
  };
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transações</h1>
          <p className="text-sm text-slate-500 sm:text-base">Acompanhe todas as suas movimentações</p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-end xl:shrink-0">
          {selectedImportSource && (
            <ImportSourceSelector
              sources={importSources}
              value={selectedImportSource.id}
              onChange={(sourceId) => {
                  const selected = importSources.find((item) => item.id === sourceId);
                  setSelectedSourceId(sourceId);
                  if (selected) setSource(transactionSource(selected.type));
                  setPage(0);
              }}
              className="min-w-0 md:min-w-[15rem]"
            />
          )}
          <div
            role="group"
            aria-label="Ações de importação"
            className="flex flex-col gap-2 sm:flex-row"
          >
            <Link to="/import" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full whitespace-nowrap sm:w-auto">
                <FileUp className="mr-2 h-4 w-4" />Importar CSV
              </Button>
            </Link>
            <Link to="/open-finance" className="w-full sm:w-auto">
              <Button className="w-full whitespace-nowrap sm:w-auto">
                <Landmark className="mr-2 h-4 w-4" />Open Finance
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>
              {activeFilterCount > 0 ? `${activeFilterCount} filtro${activeFilterCount > 1 ? 's' : ''} ativo${activeFilterCount > 1 ? 's' : ''}` : 'Refine a lista de transações'}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={filtersOpen ? 'Recolher filtros' : 'Expandir filtros'}
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((current) => !current)}
          >
            {filtersOpen ? <ChevronDown className="h-5 w-5 rotate-180" /> : <SlidersHorizontal className="h-5 w-5" />}
          </Button>
        </CardHeader>
        <CardContent className={filtersOpen ? 'block' : 'hidden md:block'}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Select
              aria-label="Filtrar por tipo"
              options={typeOptions}
              value={filters.type}
              onChange={(event) => updateFilter('type', event.target.value)}
            />
            <Select
              aria-label="Filtrar por categoria"
              options={categoryOptions}
              value={filters.category}
              onChange={(event) => updateFilter('category', event.target.value)}
            />
            <Input
              aria-label="Data inicial"
              type="date"
              value={filters.startDate}
              onChange={(event) => updateFilter('startDate', event.target.value)}
            />
            <Input
              aria-label="Data final"
              type="date"
              value={filters.endDate}
              onChange={(event) => updateFilter('endDate', event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="danger">
          <AlertTitle>Erro ao carregar transações</AlertTitle>
          <AlertDescription>Tente novamente em alguns instantes.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading || sourcesLoading ? (
            <TransactionTableSkeleton />
          ) : transactions.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title="Nenhuma transação encontrada"
              description={activeFilterCount > 0
                ? 'Nenhuma movimentação corresponde aos filtros selecionados.'
                : 'Importe um arquivo CSV ou conecte uma conta Open Finance para visualizar suas movimentações.'}
            />
          ) : (
            <div className="divide-y divide-slate-100" role="table" aria-label="Lista de transações">
              <div className="hidden grid-cols-[minmax(0,2fr)_minmax(8rem,1fr)_8rem_7rem_minmax(8rem,1fr)] bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500 md:grid" role="row">
                <span className="px-6 py-3" role="columnheader">Descrição</span>
                <span className="px-4 py-3" role="columnheader">Categoria</span>
                <span className="px-4 py-3" role="columnheader">Data</span>
                <span className="px-4 py-3" role="columnheader">Tipo</span>
                <span className="px-6 py-3 text-right" role="columnheader">Valor</span>
              </div>
              {transactions.map((transaction) => (
                <article
                  key={transaction.id}
                  role="row"
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 p-4 transition-colors hover:bg-slate-50 md:grid-cols-[minmax(0,2fr)_minmax(8rem,1fr)_8rem_7rem_minmax(8rem,1fr)] md:items-center md:gap-0 md:p-0"
                >
                  <h3 role="cell" className="col-start-1 row-start-1 truncate text-sm font-semibold text-slate-900 md:col-auto md:row-auto md:px-6 md:py-4" title={transaction.description}>
                    {transaction.description}
                  </h3>
                  <span role="cell" className="col-start-1 row-start-3 w-fit max-w-full truncate rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 md:col-auto md:row-auto md:rounded-none md:bg-transparent md:px-4 md:py-4 md:text-sm md:font-normal">
                    {transaction.category || 'OUTROS'}
                  </span>
                  <time role="cell" className="col-start-1 row-start-2 text-xs text-slate-500 md:col-auto md:row-auto md:px-4 md:py-4 md:text-sm" dateTime={transaction.date}>
                    {formatDate(transaction.date)}
                  </time>
                  <div role="cell" className="col-start-2 row-start-2 text-right md:col-auto md:row-auto md:px-4 md:py-4 md:text-left">
                    <Badge
                      variant={transaction.type === 'INCOME' ? 'success' : 'danger'}
                      className={
                        resolvedTheme === 'dark'
                          ? transaction.type === 'INCOME'
                            ? 'border-emerald-300/30 bg-emerald-400/14 text-emerald-200'
                            : 'border-red-300/35 bg-red-400/14 text-red-200'
                          : ''
                      }
                    >
                      {transaction.type === 'INCOME' ? 'Receita' : 'Despesa'}
                    </Badge>
                  </div>
                  <p role="cell" className={`col-start-2 row-start-1 shrink-0 text-right text-sm font-bold tabular-nums md:col-auto md:row-auto md:px-6 md:py-4 ${
                      transaction.type === 'INCOME' ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                    {transaction.type === 'INCOME' ? '+' : '-'}{formatCurrency(transaction.amount)}
                  </p>
                </article>
              ))}
            </div>
          )}

          {!isLoading && !error && totalElements > 0 && (
            <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <span>{totalElements.toLocaleString('pt-BR')} transações</span>
                {isFetching && <span className="text-primary-600">Atualizando...</span>}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-start">
                <span className="text-sm text-slate-600">Por página</span>
                <div className="w-20">
                  <Select
                    aria-label="Transações por página"
                    options={pageSizeOptions}
                    value={String(size)}
                    onChange={(event) => {
                      setSize(Number(event.target.value));
                      setPage(0);
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Página anterior"
                  disabled={currentPage === 0 || isFetching}
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs font-medium text-slate-600 sm:hidden">
                  {currentPage + 1} de {totalPages}
                </span>
                <div className="hidden items-center gap-2 sm:flex">
                  {visiblePages.map((pageNumber) => (
                    <Button
                      key={pageNumber}
                      type="button"
                      variant={pageNumber === currentPage ? 'default' : 'outline'}
                      size="sm"
                      aria-label={`Página ${pageNumber + 1}`}
                      onClick={() => setPage(pageNumber)}
                      disabled={isFetching}
                    >
                      {pageNumber + 1}
                    </Button>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Próxima página"
                  disabled={currentPage + 1 >= totalPages || isFetching}
                  onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
