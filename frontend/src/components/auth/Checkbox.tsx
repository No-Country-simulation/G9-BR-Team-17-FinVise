import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from './ThemeProvider';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  helperText?: string;
  error?: string;
}

export function Checkbox({ label, helperText, error, className, ...props }: CheckboxProps) {
  const { resolvedTheme } = useTheme();

  return (
    <label className={cn('flex cursor-pointer items-start gap-3', className)}>
      <span className={cn('relative mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border', resolvedTheme === 'dark' ? 'border-white/15 bg-white/5' : 'border-slate-300 bg-white/85')}>
        <input
          type="checkbox"
          className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
          {...props}
        />
        <Check className={cn('h-3.5 w-3.5 scale-0 transition-transform peer-checked:scale-100', resolvedTheme === 'dark' ? 'text-cyan-300' : 'text-primary-600')} />
      </span>
      <span className="min-w-0">
        {label && <span className={cn('block text-[15px] font-medium', resolvedTheme === 'dark' ? 'text-slate-100' : 'text-slate-700')}>{label}</span>}
        {helperText && <span className={cn('block text-sm', resolvedTheme === 'dark' ? 'text-slate-400' : 'text-slate-500')}>{helperText}</span>}
        {error && <span className="block text-sm text-red-300">{error}</span>}
      </span>
    </label>
  );
}