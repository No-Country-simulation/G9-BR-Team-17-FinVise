import { Moon, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useTheme } from './useTheme';

interface AuthShellProps {
  children: ReactNode;
  logo?: ReactNode;
}

export function AuthShell({ children, logo }: AuthShellProps) {
  const { resolvedTheme: theme, setTheme } = useTheme();

  const themeClasses = useMemo(
    () => ({
      page:
        theme === 'dark'
          ? 'bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.22),transparent_24%),radial-gradient(circle_at_80%_40%,rgba(14,165,233,0.14),transparent_25%),linear-gradient(135deg,#04111d_0%,#0b1a2b_55%,#12324a_100%)] text-white'
          : 'bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.12),transparent_24%),radial-gradient(circle_at_80%_40%,rgba(14,165,233,0.08),transparent_25%),linear-gradient(135deg,#eef4f9_0%,#dfe8f0_55%,#cbd7e3_100%)] text-slate-900',
      card:
        theme === 'dark'
          ? 'border-white/12 bg-white/8 text-white shadow-[0_30px_90px_rgba(2,8,23,0.38)]'
          : 'border-white/70 bg-white/88 text-slate-900 shadow-[0_28px_80px_rgba(15,23,42,0.15)]',
      smallCard:
        theme === 'dark'
          ? 'border-white/12 bg-white/5 text-slate-200'
          : 'border-slate-200 bg-white/85 text-slate-700',
      brand:
        theme === 'dark'
          ? 'border-white/14 bg-white/10 text-cyan-200'
          : 'border-slate-200 bg-white/90 text-cyan-700',
      toggle:
        theme === 'dark'
          ? 'border-white/15 bg-white/10 text-white hover:bg-white/15'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
      label:
        theme === 'dark'
          ? 'border-white/10 bg-white/5 text-slate-300'
          : 'border-slate-200 bg-white text-slate-500',
      inputNote: theme === 'dark' ? 'text-slate-300' : 'text-slate-500',
    }),
    [theme]
  );

  return (
    <div className={`min-h-screen overflow-hidden ${themeClasses.page}`}>
      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute left-[-8%] top-[18%] h-[28rem] w-[28rem] rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="absolute right-[-10%] top-[8%] h-[26rem] w-[26rem] rounded-full bg-sky-400/12 blur-3xl" />
          <div className="absolute left-[14%] top-[48%] h-px w-[18rem] bg-cyan-300/30" />
          <div className="absolute right-[8%] top-[60%] h-px w-[14rem] bg-sky-300/20" />
          <div className="absolute inset-y-0 left-1/2 w-px bg-white/10" />
        </div>

        <header className="relative z-10 flex items-center justify-between gap-4 pb-6 pt-1">
          <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 backdrop-blur-xl ${themeClasses.brand}`}>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-lg font-semibold">
              {logo ?? <span>F</span>}
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">FinVise</p>
              <p className={`text-xs ${theme === 'dark' ? 'text-slate-300' : 'text-slate-500'}`}>Financial intelligence, simplified</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium backdrop-blur-xl transition-colors ${themeClasses.toggle}`}
            aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
            aria-pressed={theme === 'dark'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === 'dark' ? 'Claro' : 'Escuro'}
          </button>
        </header>

        <main className="relative z-10 flex min-h-0 flex-1 items-center justify-center">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  );
}
