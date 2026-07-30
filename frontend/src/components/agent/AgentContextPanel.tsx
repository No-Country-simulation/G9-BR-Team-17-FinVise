import { Check, Database, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ImportSource } from '@/services/importSourceService';
import { TransactionSource } from '@/types/transaction';

interface AgentContextPanelProps {
  source: TransactionSource;
  availableSources: ImportSource[];
  selectedSourceIds: string[];
  isOpen: boolean;
  disabled: boolean;
  sourcesLoading: boolean;
  onSourceChange: (source: TransactionSource) => void;
  onToggleSource: (sourceId: string) => void;
  onToggleAll: () => void;
}

const sourceOptions: Array<{
  value: TransactionSource;
  label: string;
  icon: typeof FileText;
}> = [
  {
    value: 'CSV_IMPORT',
    label: 'Arquivos CSV',
    icon: FileText,
  },
  {
    value: 'OPEN_FINANCE_PLUGGY',
    label: 'Open Finance',
    icon: Database,
  },
];

export function AgentContextPanel({
  source,
  availableSources,
  selectedSourceIds,
  isOpen,
  disabled,
  sourcesLoading,
  onSourceChange,
  onToggleSource,
  onToggleAll,
}: AgentContextPanelProps) {
  if (!isOpen) return null;

  const selectedCount = selectedSourceIds.length;
  const allSelected = availableSources.length > 0 && selectedCount === availableSources.length;

  return (
    <div
      id="agent-context-controls"
      role="dialog"
      aria-label="Fontes usadas na resposta"
      className="absolute bottom-[calc(100%+0.75rem)] left-0 z-30 w-[min(34rem,calc(100vw-3rem))] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl shadow-slate-900/10 sm:p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Dados da conversa</p>
          <p className="text-xs text-slate-500">
            Escolha o que o FinVise pode consultar
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-primary-50 px-2 py-1 text-[11px] font-semibold text-primary-700">
          {selectedCount} {selectedCount === 1 ? 'selecionado' : 'selecionados'}
        </span>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Origem
        </legend>
        <div className="grid grid-cols-2 gap-2">
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
                  'flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50',
                  selected
                    ? 'border-primary-300 bg-primary-50 text-primary-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-3">
        <legend className="sr-only">Arquivos permitidos</legend>
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Arquivos
          </span>
          {availableSources.length > 1 && (
            <button
              type="button"
              disabled={disabled}
              onClick={onToggleAll}
              className="min-h-8 rounded-md px-1.5 text-[11px] font-semibold text-primary-700 hover:bg-primary-50 hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50"
            >
              {allSelected ? 'Limpar seleção' : 'Selecionar todos'}
            </button>
          )}
        </div>

        {sourcesLoading && (
          <div
            aria-label="Carregando arquivos"
            className="h-16 animate-pulse rounded-xl bg-slate-100"
          />
        )}

        {!sourcesLoading && availableSources.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-700">
              Nenhum dado disponível nessa origem.
            </p>
            <Link
              to={source === 'CSV_IMPORT' ? '/import' : '/open-finance'}
              className="mt-1 inline-flex min-h-8 items-center text-xs font-semibold text-primary-700 hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              {source === 'CSV_IMPORT' ? 'Importar arquivo' : 'Conectar conta'}
            </Link>
          </div>
        )}

        {!sourcesLoading && availableSources.length > 0 && (
          <div className="grid max-h-36 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
            {availableSources.map((item) => {
              const selected = selectedSourceIds.includes(item.id);

              return (
                <label
                  key={item.id}
                  className={cn(
                    'flex min-h-10 cursor-pointer items-center gap-2.5 rounded-xl border px-2.5 py-2 transition-colors focus-within:ring-2 focus-within:ring-primary-500',
                    selected
                      ? 'border-primary-300 bg-primary-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50',
                    disabled && 'cursor-not-allowed opacity-50'
                  )}
                >
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={selected}
                    disabled={disabled}
                    onChange={() => onToggleSource(item.id)}
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                      selected
                        ? 'border-primary-600 bg-primary-600 text-white'
                        : 'border-slate-300 bg-white text-transparent'
                    )}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate text-xs font-semibold text-slate-800"
                      title={item.displayName}
                    >
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
    </div>
  );
}
