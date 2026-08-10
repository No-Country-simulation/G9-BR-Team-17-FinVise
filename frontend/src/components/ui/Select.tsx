import { cn } from '@/lib/utils';
import { useTheme } from '@/components/auth/useTheme';
import { useId } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.ComponentPropsWithRef<'select'> {
  options: SelectOption[];
  error?: string;
}

function Select({ className, options, error, ref, id, ...props }: SelectProps) {
  const { resolvedTheme } = useTheme();
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = error ? `${selectId}-error` : undefined;
  const describedBy = [props['aria-describedby'], errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="w-full">
      <select
        ref={ref}
        id={selectId}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={describedBy}
        className={cn(
          'flex h-11 w-full rounded-[14px] border px-4 py-2 text-base backdrop-blur-xl focus:border-transparent focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm',
          resolvedTheme === 'dark'
            ? 'border-white/12 bg-white/6 text-white focus:ring-cyan-300/40'
            : 'border-slate-200/80 bg-white/78 text-slate-900 focus:ring-primary-500',
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
      {error && <p id={errorId} className={cn('mt-1 text-sm', resolvedTheme === 'dark' ? 'text-red-300' : 'text-red-700')}>{error}</p>}
    </div>
  );
}

export { Select };
