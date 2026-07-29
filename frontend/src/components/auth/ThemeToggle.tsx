import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  theme: 'dark' | 'light';
  onToggle: () => void;
  className?: string;
}

export function ThemeToggle({ theme, onToggle, className }: ThemeToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'inline-flex h-12 items-center gap-2 rounded-full border px-4 text-sm font-medium backdrop-blur-xl transition-transform hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300',
        theme === 'dark'
          ? 'border-white/10 bg-white/8 text-slate-100'
          : 'border-slate-200 bg-white text-slate-700',
        className
      )}
      aria-pressed={theme === 'dark'}
      aria-label={theme === 'dark' ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {theme === 'dark' ? 'Claro' : 'Escuro'}
    </button>
  );
}