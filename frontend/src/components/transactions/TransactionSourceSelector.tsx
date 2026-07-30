import { Select } from '@/components/ui/Select';
import { TransactionSource } from '@/types/transaction';

interface TransactionSourceSelectorProps {
  value: TransactionSource;
  onChange: (source: TransactionSource) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
}

export function TransactionSourceSelector({
  value,
  onChange,
  label = 'Origem dos dados',
  className,
  disabled = false,
}: TransactionSourceSelectorProps) {
  return (
    <label className={className ?? 'block min-w-0 w-full sm:max-w-sm xl:w-auto xl:min-w-56'}>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <Select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as TransactionSource)}
        options={[
          { value: 'CSV_IMPORT', label: 'Arquivo CSV' },
          { value: 'OPEN_FINANCE_PLUGGY', label: 'Open Finance' },
        ]}
      />
    </label>
  );
}
