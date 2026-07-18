import { cn } from '@/lib/utils';

export interface InputProps extends React.ComponentPropsWithRef<'input'> {
  error?: string;
}

function Input({ className, error, ref, ...props }: InputProps) {
  return (
    <div className="w-full">
      <input
        ref={ref}
        className={cn(
          'flex h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:text-sm',
          error && 'border-danger focus:ring-danger',
          className
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

export { Input };
