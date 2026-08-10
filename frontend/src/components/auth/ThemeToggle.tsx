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
        'inline-flex h-10 min-w-10 items-center justify-center gap-2 rounded-full border px-3 text-[13px] font-semibold shadow-sm backdrop-blur-xl transition-all hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 sm:px-4',
        theme === 'dark'
          ? 'border-white/15 bg-slate-950/40 text-slate-100 hover:bg-white/10'
          : 'border-slate-200/90 bg-white/90 text-slate-700 hover:border-slate-300 hover:text-slate-950',
        className
      )}
      aria-pressed={theme === 'dark'}
      aria-label={theme === 'dark' ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="hidden sm:inline">{theme === 'dark' ? 'Claro' : 'Escuro'}</span>
    </button>
  );
}
