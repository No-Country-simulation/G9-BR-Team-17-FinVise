import { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';

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
  const feedbackText = error || success || helperText;
  const feedbackClassName = error ? 'text-sm text-red-300' : success ? 'text-sm text-emerald-300' : 'text-sm text-slate-400';

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-2 block text-[15px] font-medium text-slate-100">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'flex h-14 w-full rounded-[14px] border border-white/10 bg-white/5 px-4 text-[16px] text-slate-50 caret-cyan-300 placeholder:text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] transition-all duration-200 focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-50',
            icon && 'pl-11',
            error && 'border-red-400/70 focus:border-red-300 focus:ring-red-400/30',
            success && 'border-emerald-400/70 focus:border-emerald-300 focus:ring-emerald-400/30',
            className
          )}
          {...props}
        />
      </div>
      {feedbackText ? <p className={cn('mt-1.5', feedbackClassName)}>{feedbackText}</p> : null}
    </div>
  );
});