import { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  success?: string;
  icon?: React.ReactNode;
  endAdornment?: React.ReactNode;
}

export const AuthInput = forwardRef<HTMLInputElement, InputProps>(function AuthInput(
  { className, label, helperText, error, success, icon, endAdornment, id, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const feedbackText = error || success || helperText;
  const feedbackId = `${inputId}-feedback`;
  const describedBy = [props['aria-describedby'], feedbackText ? feedbackId : null].filter(Boolean).join(' ') || undefined;
  const feedbackClassName = error ? 'text-sm text-red-200' : success ? 'text-sm text-emerald-200' : 'text-sm text-slate-300';

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-2 block text-[15px] font-semibold text-slate-50">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={describedBy}
          className={cn(
            'flex h-14 w-full rounded-[14px] border border-white/15 bg-white/7 px-4 text-[16px] text-slate-50 caret-cyan-300 placeholder:text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/45 disabled:cursor-not-allowed disabled:opacity-50',
            icon && 'pl-11',
            error && 'border-red-400/70 focus:border-red-300 focus:ring-red-400/30',
            success && 'border-emerald-400/70 focus:border-emerald-300 focus:ring-emerald-400/30',
            className
          )}
          {...props}
        />
        {endAdornment}
      </div>
      {feedbackText ? <p id={feedbackId} className={cn('mt-1.5', feedbackClassName)}>{feedbackText}</p> : null}
    </div>
  );
});