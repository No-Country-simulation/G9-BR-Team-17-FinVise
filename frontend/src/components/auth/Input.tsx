import { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from './ThemeProvider';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  success?: string;
  icon?: React.ReactNode;
}

export const AuthInput = forwardRef<HTMLInputElement, InputProps>(function AuthInput(
  { className, label, helperText, error, success, icon, id, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const { resolvedTheme } = useTheme();
  const feedbackText = error || success || helperText;
  const feedbackClassName = error
    ? 'text-sm text-red-300'
    : success
      ? 'text-sm text-emerald-300'
      : resolvedTheme === 'dark'
        ? 'text-sm text-slate-400'
        : 'text-sm text-slate-500';
  const feedbackId = feedbackText ? `${inputId}-feedback` : undefined;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className={cn('mb-2 block text-[15px] font-medium', resolvedTheme === 'dark' ? 'text-slate-100' : 'text-slate-700')}>
          {label}
        </label>
      )}
      <div className="relative">
        {icon && <span className={cn('pointer-events-none absolute left-4 top-1/2 -translate-y-1/2', resolvedTheme === 'dark' ? 'text-slate-400' : 'text-slate-500')}>{icon}</span>}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={feedbackId}
          className={cn(
            'flex h-14 w-full rounded-[14px] border px-4 text-[16px] caret-cyan-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] transition-all duration-200 focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-50',
            resolvedTheme === 'dark'
              ? 'border-white/10 bg-white/5 text-slate-50 placeholder:text-slate-500'
              : 'border-slate-200/80 bg-white/78 text-slate-900 placeholder:text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]',
            icon && 'pl-11',
            error && 'border-red-400/70 focus:border-red-300 focus:ring-red-400/30',
            success && 'border-emerald-400/70 focus:border-emerald-300 focus:ring-emerald-400/30',
            className
          )}
          {...props}
        />
      </div>
      {feedbackText ? (
        <p id={feedbackId} className={cn('mt-1.5', feedbackClassName)} aria-live={error ? 'polite' : undefined}>
          {feedbackText}
        </p>
      ) : null}
    </div>
  );
});