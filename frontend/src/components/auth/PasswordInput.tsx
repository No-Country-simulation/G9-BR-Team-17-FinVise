import { Eye, EyeOff, Lock } from 'lucide-react';
import { useState } from 'react';
import { AuthInput } from './Input';
import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from './ThemeProvider';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  helperText?: string;
  error?: string;
  success?: string;
}

export function PasswordInput({ ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const { resolvedTheme } = useTheme();

  return (
    <div className="relative">
      <AuthInput
        type={visible ? 'text' : 'password'}
        icon={<Lock className="h-4 w-4" />}
        className="pr-12"
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className={cn(
          'absolute right-4 top-1/2 -translate-y-1/2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300',
          resolvedTheme === 'dark' ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'
        )}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visible}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}