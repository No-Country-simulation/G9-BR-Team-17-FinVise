import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  helperText?: string;
  error?: string;
}

export function Checkbox({ label, helperText, error, className, ...props }: CheckboxProps) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3', className)}>
      <span className="relative mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center">
        <input
          type="checkbox"
          className="peer absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-pointer opacity-0"
          {...props}
        />
        <Check className="h-5 w-5 rounded-[6px] border border-white/15 bg-white/5 p-0.5 text-transparent transition-colors peer-checked:text-cyan-300 peer-focus-visible:ring-2 peer-focus-visible:ring-cyan-300 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-slate-950" />
      </span>
      <span className="min-w-0">
        {label && <span className="block text-[15px] font-medium text-slate-100">{label}</span>}
        {helperText && <span className="block text-sm text-slate-400">{helperText}</span>}
        {error && <span className="block text-sm text-red-300">{error}</span>}
      </span>
    </label>
  );
}