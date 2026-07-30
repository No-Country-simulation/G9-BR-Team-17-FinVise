import {
  Check,
  ChevronDown,
  Database,
  FileText,
  Info,
  SlidersHorizontal,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Select } from '@/components/ui/Select';
import {
  retrievalDepthLabel,
  retrievalDepthOptions,
} from '@/components/agent/agentContextOptions';
import { cn } from '@/lib/utils';
import { ImportSource } from '@/services/importSourceService';
import { TransactionSource } from '@/types/transaction';

interface AgentContextPanelProps {
  source: TransactionSource;
  availableSources: ImportSource[];
  selectedSourceIds: string[];
  topK: number;
  isOpen: boolean;
  disabled: boolean;
  sourcesLoading: boolean;
  onToggleOpen: () => void;
  onSourceChange: (source: TransactionSource) => void;
  onToggleSource: (sourceId: string) => void;
  onToggleAll: () => void;
  onTopKChange: (topK: number) => void;
}

const sourceOptions: Array<{
  value: TransactionSource;
  label: string;
  description: string;
  icon: typeof FileText;
}> = [
  {
    value: 'CSV_IMPORT',
    label: 'Arquivo CSV',
    description: 'Dados enviados',
    icon: FileText,
  },
  {
    value: 'OPEN_FINANCE_PLUGGY',
    label: 'Open Finance',
    description: 'Contas conectadas',
    icon: Database,
  },
];

export function AgentContextPanel({
  source,
  availableSources,
  selectedSourceIds,
  topK,
  isOpen,
  disabled,
  sourcesLoading,
  onToggleOpen,
  onSourceChange,
  onToggleSource,
  onToggleAll,
  onTopKChange,
}: AgentContextPanelProps) {
  const selectedCount = selectedSourceIds.length;
  const allSelected = availableSources.length > 0 && selectedCount === availableSources.length;
  const selectedDepth = retrievalDepthOptions.find((option) => option.value === topK);

  return (
    <section className="border-b border-slate-200" aria-labelledby="agent-context-title">
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
            <SlidersHorizontal className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 id="agent-context-title" className="text-sm font-semibold text-slate-900">
              Dados usados na resposta
            </h2>
            <p className="truncate text-xs text-slate-500">
              {selectedCount > 0
                ? `${selectedCount} ${selectedCount === 1 ? 'arquivo selecionado' : 'arquivos selecionados'}`
                : 'Nenhum arquivo selecionado'}
              {' · '}
              Busca {retrievalDepthLabel(topK).toLocaleLowerCase('pt-BR')}
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls="agent-context-controls"
          onClick={onToggleOpen}
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          {isOpen ? 'Ocultar' : 'Ajustar'}
          <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
        </button>
      </div>

      {isOpen && (
        <div
          id="agent-context-controls"
          className="grid gap-5 border-t border-slate-200 bg-slate-50/80 p-4 md:grid-cols-12 sm:p-5"
        >
          <fieldset className="min-w-0 md:col-span-4">
            <legend className="mb-2 text-xs font-semibold text-slate-700">
              1. Escolha a origem
            </legend>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-1 xl:grid-cols-2">
              {sourceOptions.map((option) => {
                const Icon = option.icon;
                const selected = source === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    disabled={disabled}
                    onClick={() => onSourceChange(option.value)}
                    className={cn(
                      'flex min-w-0 items-center gap-2 rounded-xl border p-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50',
                      selected
                        ? 'border-primary-300 bg-primary-50 text-primary-900 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                        selected ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-500'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold">{option.label}</span>
                      <span className="block truncate text-[10px] text-slate-500">
                        {option.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="min-w-0 md:col-span-5">
            <legend className="sr-only">2. Selecione os arquivos</legend>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">
                2. Selecione os arquivos
              </span>
              {availableSources.length > 1 && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={onToggleAll}
                  className="text-[11px] font-semibold text-primary-700 hover:text-primary-800 disabled:opacity-50"
                >
                  {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                </button>
              )}
            </div>

            {sourcesLoading && (
              <div className="h-[4.5rem] animate-pulse rounded-xl border border-slate-200 bg-white" />
            )}

            {!sourcesLoading && availableSources.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-3">
                <p className="text-xs font-medium text-slate-700">
                  Nenhum dado disponível nessa origem.
                </p>
                <Link
                  to={source === 'CSV_IMPORT' ? '/import' : '/open-finance'}
                  className="mt-1 inline-flex text-xs font-semibold text-primary-700 hover:text-primary-800"
                >
                  {source === 'CSV_IMPORT' ? 'Importar um arquivo' : 'Conectar uma conta'}
                </Link>
              </div>
            )}

            {!sourcesLoading && availableSources.length > 0 && (
              <div className="grid max-h-36 gap-2 overflow-y-auto pr-1">
                {availableSources.map((item) => {
                  const selected = selectedSourceIds.includes(item.id);

                  return (
                    <label
                      key={item.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-xl border bg-white p-2.5 transition-all',
                        selected
                          ? 'border-primary-300 ring-1 ring-primary-100'
                          : 'border-slate-200 hover:border-slate-300',
                        disabled && 'cursor-not-allowed opacity-50'
                      )}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={selected}
                        disabled={disabled}
                        onChange={() => onToggleSource(item.id)}
                      />
                      <span
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                          selected ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-500'
                        )}
                      >
                        {selected
                          ? <Check className="h-4 w-4" />
                          : item.type === 'CSV'
                            ? <FileText className="h-4 w-4" />
                            : <Database className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-slate-800" title={item.displayName}>
                          {item.displayName}
                        </span>
                        <span className="block text-[10px] text-slate-500">
                          {item.transactionCount.toLocaleString('pt-BR')} transações
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>

          <label className="min-w-0 md:col-span-3">
            <span className="mb-2 block text-xs font-semibold text-slate-700">
              3. Defina a profundidade
            </span>
            <Select
              aria-label="Profundidade da busca"
              value={String(topK)}
              disabled={disabled}
              onChange={(event) => onTopKChange(Number(event.target.value))}
              options={retrievalDepthOptions.map((option) => ({
                value: String(option.value),
                label: `${option.label} · ${option.description}`,
              }))}
              className="border-slate-200 bg-white"
            />
            <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-4 text-slate-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {selectedDepth?.value === 5
                ? 'Recomendado: bom equilíbrio entre precisão e contexto.'
                : 'Mais evidências ampliam a busca, mas podem adicionar ruído.'}
            </p>
          </label>
        </div>
      )}
    </section>
  );
}
