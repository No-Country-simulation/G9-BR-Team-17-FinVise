import { Eye, EyeOff, Lock } from 'lucide-react';
import { useState } from 'react';
import { AuthInput } from './Input';
import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from './useTheme';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  helperText?: string;
  error?: string;
  success?: string;
  variant?: 'default' | 'grouped';
  showIcon?: boolean;
  hideFeedback?: boolean;
}

export function PasswordInput({ showIcon = true, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const { resolvedTheme } = useTheme();

  return (
    <AuthInput
      type={visible ? 'text' : 'password'}
      icon={showIcon ? <Lock className="h-4 w-4" /> : undefined}
      className="pr-12"
      endAdornment={(
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className={cn(
            'absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400',
            resolvedTheme === 'dark' ? 'text-slate-400 hover:bg-white/5 hover:text-slate-100' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
          )}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      )}
      {...props}
    />
  );
}
