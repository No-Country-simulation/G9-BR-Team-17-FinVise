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
      <span className="relative mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border border-white/15 bg-white/5">
        <input
          type="checkbox"
          className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
          {...props}
        />
        <Check className="h-3.5 w-3.5 scale-0 text-cyan-300 transition-transform peer-checked:scale-100" />
      </span>
      <span className="min-w-0">
        {label && <span className="block text-[15px] font-medium text-slate-100">{label}</span>}
        {helperText && <span className="block text-sm text-slate-400">{helperText}</span>}
        {error && <span className="block text-sm text-red-300">{error}</span>}
      </span>
    </label>
  );
}