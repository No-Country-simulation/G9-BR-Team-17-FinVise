import { Check } from 'lucide-react';
import { useId } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from './useTheme';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  helperText?: string;
  error?: string;
}

export function Checkbox({ label, helperText, error, className, id, ...props }: CheckboxProps) {
  const { resolvedTheme } = useTheme();
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const feedbackId = helperText || error ? `${inputId}-feedback` : undefined;

  return (
    <label className={cn('flex cursor-pointer items-start gap-2.5', className)}>
      <span className="relative mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center">
        <input
          id={inputId}
          type="checkbox"
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={[props['aria-describedby'], feedbackId].filter(Boolean).join(' ') || undefined}
          className="peer absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-pointer opacity-0"
          {...props}
        />
        <Check
          className={cn(
            'h-5 w-5 rounded-[6px] border p-0.5 text-transparent transition-colors peer-checked:border-teal-700 peer-checked:bg-teal-700 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-cyan-500 peer-focus-visible:ring-offset-2',
            resolvedTheme === 'dark'
              ? 'border-white/20 bg-white/5 peer-focus-visible:ring-offset-slate-950'
              : 'border-slate-300 bg-white peer-focus-visible:ring-offset-white'
          )}
        />
      </span>
      <span className="min-w-0">
        {label && <span className={cn('block whitespace-nowrap text-sm font-medium', resolvedTheme === 'dark' ? 'text-slate-100' : 'text-slate-800')}>{label}</span>}
        {(helperText || error) && (
          <span
            id={feedbackId}
            className={cn(
              'block text-sm',
              error
                ? resolvedTheme === 'dark' ? 'text-red-300' : 'text-red-700'
                : resolvedTheme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            )}
          >
            {error || helperText}
          </span>
        )}
      </span>
    </label>
  );
}
