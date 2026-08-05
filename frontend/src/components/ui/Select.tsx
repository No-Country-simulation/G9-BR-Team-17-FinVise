import { cn } from '@/lib/utils';
import { useTheme } from '@/components/auth/useTheme';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.ComponentPropsWithRef<'select'> {
  options: SelectOption[];
  error?: string;
}

function Select({ className, options, error, ref, ...props }: SelectProps) {
  const { resolvedTheme } = useTheme();

  return (
    <div className="w-full">
      <select
        ref={ref}
        className={cn(
          'flex h-11 w-full rounded-[14px] border px-4 py-2 text-base backdrop-blur-xl focus:border-transparent focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:text-sm',
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
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

export { Select };
