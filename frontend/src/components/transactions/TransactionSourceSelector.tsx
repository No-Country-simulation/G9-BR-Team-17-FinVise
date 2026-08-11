import { FileSpreadsheet, Landmark } from 'lucide-react';
import { ChoiceSelect } from '@/components/ui/ChoiceSelect';
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
    <ChoiceSelect
      className={className ?? 'block min-w-0 w-full sm:max-w-sm xl:w-auto xl:min-w-56'}
      label={label}
      value={value}
      disabled={disabled}
      onChange={(nextValue) => onChange(nextValue as TransactionSource)}
      options={[
        {
          value: 'CSV_IMPORT',
          label: 'Arquivo CSV',
          description: 'Dados enviados por arquivo',
          icon: FileSpreadsheet,
        },
        {
          value: 'OPEN_FINANCE_PLUGGY',
          label: 'Open Finance',
          description: 'Conta conectada com segurança',
          icon: Landmark,
        },
      ]}
    />
  );
}
