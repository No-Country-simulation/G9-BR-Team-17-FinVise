import { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from './useTheme';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  success?: string;
  icon?: React.ReactNode;
  endAdornment?: React.ReactNode;
  variant?: 'default' | 'grouped';
  hideFeedback?: boolean;
}

export const AuthInput = forwardRef<HTMLInputElement, InputProps>(function AuthInput(
  { className, label, helperText, error, success, icon, endAdornment, variant = 'default', hideFeedback = false, id, ...props },
  ref
) {
  const { resolvedTheme } = useTheme();
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const feedbackText = error || success || helperText;
  const feedbackId = `${inputId}-feedback`;
  const isGrouped = variant === 'grouped';
  const describedBy = [props['aria-describedby'], feedbackText && !hideFeedback ? feedbackId : null].filter(Boolean).join(' ') || undefined;
  const feedbackClassName = error
    ? cn('text-sm', resolvedTheme === 'dark' ? 'text-red-200' : 'text-red-700')
    : success
      ? cn('text-sm', resolvedTheme === 'dark' ? 'text-emerald-200' : 'text-emerald-700')
      : cn('text-sm', resolvedTheme === 'dark' ? 'text-slate-300' : 'text-slate-600');

  return (
    <div className="w-full">
      {label && !isGrouped && (
        <label
          htmlFor={inputId}
          className={cn('mb-1.5 block text-sm font-semibold', resolvedTheme === 'dark' ? 'text-slate-100' : 'text-slate-800')}
        >
          {label}
        </label>
      )}
      <div className="relative">
        {label && isGrouped ? (
          <label
            htmlFor={inputId}
            className={cn(
              'pointer-events-none absolute left-4 top-1.5 z-10 text-[11px] font-medium leading-none',
              error
                ? resolvedTheme === 'dark' ? 'text-red-300' : 'text-red-600'
                : resolvedTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'
            )}
          >
            {label}
          </label>
        ) : null}
        {icon && (
          <span className={cn('pointer-events-none absolute left-4 top-1/2 -translate-y-1/2', resolvedTheme === 'dark' ? 'text-slate-400' : 'text-slate-500')}>
            {icon}
          </span>
        )}
        <input
          {...props}
          ref={ref}
          id={inputId}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={describedBy}
          className={cn(
            'flex w-full px-4 text-[15px] font-medium caret-cyan-600 transition-all duration-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
            isGrouped
              ? 'auth-grouped-input h-14 rounded-none border-0 bg-transparent pb-1.5 pt-5 shadow-none focus:ring-0'
              : 'h-12 rounded-xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] focus:ring-2 sm:h-[3.125rem]',
            resolvedTheme === 'dark'
              ? cn('text-slate-50 placeholder:font-normal placeholder:text-slate-400', !isGrouped && 'border-white/15 bg-slate-950/45 focus:border-cyan-300/70 focus:ring-cyan-300/25')
              : cn('text-slate-900 placeholder:font-normal placeholder:text-slate-500', !isGrouped && 'border-slate-300/90 bg-white/90 focus:border-cyan-700 focus:ring-cyan-600/15'),
            icon && 'pl-11',
            error && 'border-red-500/70 focus:border-red-500 focus:ring-red-500/25',
            success && 'border-emerald-500/70 focus:border-emerald-500 focus:ring-emerald-500/25',
            className
          )}
        />
        {endAdornment}
      </div>
      {feedbackText && !hideFeedback ? <p id={feedbackId} className={cn('mt-1.5', feedbackClassName)}>{feedbackText}</p> : null}
    </div>
  );
});
