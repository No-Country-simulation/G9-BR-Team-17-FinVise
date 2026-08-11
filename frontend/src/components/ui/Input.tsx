import { cn } from '@/lib/utils';
import { useTheme } from '@/components/auth/useTheme';
import { useId } from 'react';

export interface InputProps extends React.ComponentPropsWithRef<'input'> {
  error?: string;
}

function Input({ className, error, ref, id, ...props }: InputProps) {
  const { resolvedTheme } = useTheme();
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [props['aria-describedby'], errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="w-full">
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={describedBy}
        className={cn(
            'flex h-11 w-full rounded-[14px] border px-4 py-2 text-base caret-cyan-300 backdrop-blur-xl focus:border-transparent focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm',
            resolvedTheme === 'dark'
              ? 'border-white/12 bg-white/6 text-white placeholder:text-slate-400 focus:ring-cyan-300/40 [color-scheme:dark]'
              : 'border-slate-200/80 bg-white/78 text-slate-900 placeholder:text-slate-400 focus:ring-primary-500 [color-scheme:light]',
          error && 'border-danger focus:ring-danger',
          className
        )}
        {...props}
      />
      {error && <p id={errorId} className={cn('mt-1 text-sm', resolvedTheme === 'dark' ? 'text-red-300' : 'text-red-700')}>{error}</p>}
    </div>
  );
}

export { Input };
