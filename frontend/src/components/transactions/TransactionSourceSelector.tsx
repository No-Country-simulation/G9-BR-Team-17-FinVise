import { Select } from '@/components/ui/Select';
import { useTheme } from '@/components/auth/ThemeProvider';
import { cn } from '@/lib/utils';
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
  const { resolvedTheme } = useTheme();

  return (
    <label className={className ?? 'block min-w-0 w-full sm:max-w-sm xl:w-auto xl:min-w-56'}>
      <span className={cn('mb-1 block text-xs font-semibold uppercase tracking-wide', resolvedTheme === 'dark' ? 'text-slate-300' : 'text-slate-500')}>
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
