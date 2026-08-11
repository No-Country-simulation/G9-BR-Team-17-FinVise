import { Database, FileSpreadsheet, Landmark } from 'lucide-react';
import { ChoiceSelect } from '@/components/ui/ChoiceSelect';
import { ImportSource } from '@/services/importSourceService';

interface ImportSourceSelectorProps {
  sources: ImportSource[];
  value: string;
  onChange: (sourceId: string) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
}

export function ImportSourceSelector({
  sources,
  value,
  onChange,
  label = 'Fonte dos dados',
  className,
  disabled = false,
}: ImportSourceSelectorProps) {
  return (
    <ChoiceSelect
      value={value}
      onChange={onChange}
      label={label}
      className={className}
      disabled={disabled}
      options={sources.map((source) => ({
        value: source.id,
        label: source.displayName,
        description: source.type === 'CSV' ? 'Arquivo CSV importado' : 'Conta conectada',
        badge: source.defaultSource ? 'Padrão' : undefined,
        icon: source.type === 'CSV'
          ? FileSpreadsheet
          : source.type === 'OPEN_FINANCE'
            ? Landmark
            : Database,
      }))}
    />
  );
}
