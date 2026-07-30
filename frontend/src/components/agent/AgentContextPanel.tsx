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
      className="absolute bottom-[calc(100%+0.625rem)] left-0 z-30 w-[min(18rem,calc(100vw-2.5rem))] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10"
    >
      <fieldset>
        <legend className="sr-only">Origem</legend>
        <div className="space-y-0.5">
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
                  'flex min-h-10 w-full items-center gap-3 rounded-xl px-2.5 text-left text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50',
                  selected
                    ? 'bg-primary-50 text-primary-800'
                    : 'text-slate-700 hover:bg-slate-100'
                )}
              >
                <Icon className="h-4 w-4 shrink-0 text-slate-500" />
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {selected && <Check className="h-4 w-4 shrink-0 text-primary-600" />}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="my-1.5 h-px bg-slate-200" />

      <fieldset>
        <legend className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Arquivos permitidos
        </legend>

        {sourcesLoading && (
          <div
            aria-label="Carregando arquivos"
            className="mx-1 h-10 animate-pulse rounded-xl bg-slate-100"
          />
        )}

        {!sourcesLoading && availableSources.length === 0 && (
          <Link
            to={source === 'CSV_IMPORT' ? '/import' : '/open-finance'}
            className="flex min-h-10 items-center gap-3 rounded-xl px-2.5 text-xs font-semibold text-primary-700 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            {source === 'CSV_IMPORT'
              ? <FileText className="h-4 w-4" />
              : <Database className="h-4 w-4" />}
            {source === 'CSV_IMPORT' ? 'Importar um arquivo' : 'Conectar uma conta'}
          </Link>
        )}

        {!sourcesLoading && availableSources.length > 0 && (
          <div className="max-h-40 space-y-0.5 overflow-y-auto">
            {availableSources.map((item) => {
              const selected = selectedSourceIds.includes(item.id);

              return (
                <label
                  key={item.id}
                  className={cn(
                    'flex min-h-10 cursor-pointer items-center gap-3 rounded-xl px-2.5 text-xs transition-colors focus-within:ring-2 focus-within:ring-primary-500',
                    selected
                      ? 'bg-slate-100 font-semibold text-slate-900'
                      : 'text-slate-700 hover:bg-slate-50',
                    disabled && 'cursor-not-allowed opacity-50'
                  )}
                >
                  <FileText className="h-4 w-4 shrink-0 text-slate-500" />
                  <span className="min-w-0 flex-1 truncate" title={item.displayName}>
                    {item.displayName}
                  </span>
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
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                      selected
                        ? 'border-primary-600 bg-primary-600 text-white'
                        : 'border-slate-300 bg-white text-transparent'
                    )}
                  >
                    <Check className="h-3 w-3" />
                  </span>
                </label>
              );
            })}
          </div>
        )}

        {!sourcesLoading && availableSources.length > 1 && (
          <>
            <div className="my-1 h-px bg-slate-100" />
            <button
              type="button"
              disabled={disabled}
              onClick={onToggleAll}
              className="flex min-h-9 w-full items-center rounded-xl px-2.5 text-left text-[11px] font-semibold text-primary-700 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50"
            >
              {allSelected ? 'Limpar seleção' : 'Selecionar todos'}
            </button>
          </>
        )}
      </fieldset>
    </div>
  );
}
