import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.ComponentPropsWithRef<'select'> {
  options: SelectOption[];
  error?: string;
}

function Select({ className, options, error, ref, ...props }: SelectProps) {
  return (
    <div className="w-full">
      <select
        ref={ref}
        className={cn(
          'flex h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:text-sm',
          error && 'border-danger focus:ring-danger',
          className
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

export { Select };
