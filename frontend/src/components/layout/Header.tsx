import { Bell, ChevronRight, Menu, Moon, Settings, Sun, TrendingDown, TrendingUp, User } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useNotificationPreferences } from '@/components/auth/useNotificationPreferences';
import { useTheme } from '@/components/auth/useTheme';
import { cn, formatCurrency, getInitials } from '@/lib/utils';
import { importSourceService } from '@/services/importSourceService';
import { transactionService } from '@/services/transactionService';
import type { TransactionSource } from '@/types/transaction';

interface HeaderProps {
  userName?: string;
  onMenuClick?: () => void;
}

const notificationTickerStorageKey = 'finvise-header-ticker-enabled';

export function Header({ userName = 'Usuário', onMenuClick }: HeaderProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const { preferences } = useNotificationPreferences();
  const initials = getInitials(userName);
  const [isTickerEnabled, setIsTickerEnabled] = useState(true);
  const currentSource = (window.localStorage.getItem('finance_ai_transaction_source') as TransactionSource) || 'CSV_IMPORT';
  const { data: importSources = [] } = useQuery({
    queryKey: ['header', 'import-sources'],
    queryFn: importSourceService.getAll,
    staleTime: 60 * 1000,
  });
  const { data: summary } = useQuery({
    queryKey: ['header', 'summary', currentSource],
    queryFn: () => transactionService.getSummary(currentSource),
    staleTime: 60 * 1000,
  });
  const { data: monthlySummary = [] } = useQuery({
    queryKey: ['header', 'monthly-summary', currentSource],
    queryFn: () => transactionService.getMonthlySummary(currentSource),
    staleTime: 60 * 1000,
  });

  const tickerItems = useMemo(() => {
    const items: string[] = [];
    const latestImport = [...importSources].sort(
      (left, right) => new Date(right.lastSyncAt || right.createdAt).getTime() - new Date(left.lastSyncAt || left.createdAt).getTime()
    )[0];

    if (preferences.weeklyReport) {
      items.push(
        latestImport
          ? `Importação recente: ${latestImport.displayName} com ${latestImport.transactionCount.toLocaleString('pt-BR')} transações indexadas`
          : 'Importações: nenhuma fonte conectada até o momento'
      );
    }

    if (preferences.spendingAlerts && summary) {
      items.push(`Saldo atual: ${formatCurrency(summary.balance)} | Receitas: ${formatCurrency(summary.totalIncome)} | Despesas: ${formatCurrency(summary.totalExpense)}`);

      const currentMonth = monthlySummary[monthlySummary.length - 1];
      const previousMonth = monthlySummary[monthlySummary.length - 2];
      if (currentMonth && previousMonth) {
        const balanceDelta = currentMonth.balance - previousMonth.balance;
        if (balanceDelta !== 0) {
          items.push(`${balanceDelta > 0 ? 'Alta' : 'Queda'} no orçamento: ${formatCurrency(Math.abs(balanceDelta))} em relação ao mês anterior`);
        }
      }
    }

    if (preferences.productNews) {
      items.push('FinVise atualizado: acompanhe importações e variações do orçamento em tempo real no topo da aplicação');
    }

    return items;
  }, [importSources, monthlySummary, preferences, summary]);

  useEffect(() => {
    const storedValue = window.localStorage.getItem(notificationTickerStorageKey);
    if (storedValue === 'false') {
      setIsTickerEnabled(false);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(notificationTickerStorageKey, String(isTickerEnabled));
  }, [isTickerEnabled]);

  return (
    <header
      className={cn(
        'mobile-safe-top sticky top-0 z-30 flex min-h-16 w-full min-w-0 items-center justify-between border-b px-3 shadow-sm backdrop-blur-xl sm:px-5 lg:h-16 lg:px-8',
        resolvedTheme === 'dark'
          ? 'border-white/10 bg-[rgba(8,15,28,0.72)] text-white shadow-[0_18px_50px_rgba(2,8,23,0.26)]'
          : 'border-slate-200/80 bg-[rgba(248,250,252,0.78)] text-slate-900 shadow-[0_18px_50px_rgba(15,23,42,0.08)]'
      )}
    >
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="-ml-1 lg:hidden" onClick={onMenuClick} aria-label="Abrir menu">
          <Menu className="h-5 w-5" />
        </Button>
        <span className={cn('text-base font-bold tracking-tight lg:hidden', resolvedTheme === 'dark' ? 'text-cyan-200' : 'text-primary-700')}>FinVise</span>
      </div>

      <div className="hidden min-w-0 flex-1 overflow-hidden px-2 lg:block">
        <div
          className={cn(
            'flex h-10 items-center overflow-hidden rounded-full border px-4',
            resolvedTheme === 'dark'
              ? 'border-white/10 bg-white/[0.03]'
              : 'border-slate-200/80 bg-white/60'
          )}
        >
          {isTickerEnabled && tickerItems.length > 0 ? (
            <div className="ticker-track flex min-w-max items-center gap-8 whitespace-nowrap">
              {[...tickerItems, ...tickerItems].map((item, index) => (
                <div key={`${item}-${index}`} className={cn('inline-flex items-center gap-2 text-xs font-medium sm:text-sm', resolvedTheme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                  {item.includes('Alta')
                    ? <TrendingUp className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    : item.includes('Queda')
                      ? <TrendingDown className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                      : <Bell className={cn('h-3.5 w-3.5 shrink-0', resolvedTheme === 'dark' ? 'text-cyan-300' : 'text-primary-600')} />}
                  <span>{item}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={cn('truncate text-sm font-medium', resolvedTheme === 'dark' ? 'text-slate-300' : 'text-slate-600')}>
              {isTickerEnabled
                ? 'Nenhuma atualização financeira disponível no momento.'
                : 'FinVise: inteligência financeira simplificada.'}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={resolvedTheme === 'dark' ? 'true' : 'false'}
          aria-label={resolvedTheme === 'dark' ? 'Alternar para modo claro' : 'Alternar para modo escuro'}
          title={resolvedTheme === 'dark' ? 'Modo escuro ativo' : 'Modo claro ativo'}
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className={cn(
            'group relative inline-flex h-11 w-20 items-center rounded-full border px-1.5 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60',
            resolvedTheme === 'dark'
              ? 'border-cyan-300/35 bg-[linear-gradient(180deg,rgba(8,24,42,0.95),rgba(5,15,28,0.95))] shadow-[0_10px_24px_rgba(2,8,23,0.45)]'
              : 'border-cyan-200 bg-[linear-gradient(180deg,#f7fdff_0%,#e6f7ff_100%)] shadow-[0_8px_20px_rgba(15,23,42,0.10)]'
          )}
        >
          <span
            className={cn(
              'pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 transition-opacity duration-300',
              resolvedTheme === 'dark' ? 'opacity-0' : 'opacity-100'
            )}
            aria-hidden="true"
          >
            <Sun className="h-4 w-4 text-amber-500" />
          </span>
          <span
            className={cn(
              'pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 transition-opacity duration-300',
              resolvedTheme === 'dark' ? 'opacity-100' : 'opacity-0'
            )}
            aria-hidden="true"
          >
            <Moon className="h-4 w-4 text-cyan-300/70" />
          </span>
          <span
            className={cn(
              'pointer-events-none inline-flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-300',
              resolvedTheme === 'dark'
                ? 'translate-x-9 border-cyan-100/35 bg-[linear-gradient(180deg,#f8fbff_0%,#e5eef8_100%)] text-slate-900 shadow-[0_5px_16px_rgba(0,0,0,0.45)]'
                : 'translate-x-0 border-cyan-100 bg-white text-amber-500 shadow-[0_5px_14px_rgba(15,23,42,0.18)]'
            )}
            aria-hidden="true"
          >
            {resolvedTheme === 'dark' ? <Moon className="h-4 w-4 text-slate-950" /> : <Sun className="h-4 w-4" />}
          </span>
        </button>

        <Link
          to="/settings"
          aria-label="Abrir configurações"
          title="Configurações"
          className={cn(
            'inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-300 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300',
            resolvedTheme === 'dark' ? 'hover:bg-white/8 hover:text-white' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          )}
        >
          <Settings className="h-5 w-5 text-current" />
        </Link>

        <Button
          variant="ghost"
          size="icon"
          aria-label={isTickerEnabled ? 'Desativar ticker de notificações' : 'Ativar ticker de notificações'}
          aria-pressed={isTickerEnabled ? 'true' : 'false'}
          onClick={() => setIsTickerEnabled((current) => !current)}
          className={cn(
            isTickerEnabled && (resolvedTheme === 'dark' ? 'bg-cyan-400/12 text-cyan-100' : 'bg-primary-50 text-primary-700')
          )}
        >
          <Bell className="h-5 w-5 text-current" />
        </Button>
        <Link
          to="/profile"
          aria-label={`Abrir perfil de ${userName}`}
          title={userName}
          className={cn(
            'group flex h-11 items-center gap-2 rounded-full border px-2.5 outline-none transition-all focus-visible:ring-2 focus-visible:ring-cyan-300/50 sm:px-3',
            resolvedTheme === 'dark'
              ? 'border-white/10 bg-white/5 hover:bg-white/10'
              : 'border-slate-200 bg-white/70 hover:bg-white'
          )}
        >
          <span
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
              resolvedTheme === 'dark'
                ? 'bg-cyan-400/15 text-cyan-100 group-hover:bg-cyan-400/20'
                : 'bg-primary-100 text-primary-700 group-hover:bg-primary-200'
            )}
            aria-hidden="true"
          >
            <User className="h-4 w-4" />
          </span>
          <span className={cn('hidden text-sm font-medium sm:inline', resolvedTheme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
            {initials}
          </span>
          <ChevronRight className={cn('hidden h-4 w-4 sm:block', resolvedTheme === 'dark' ? 'text-slate-400' : 'text-slate-500')} />
          <span className="sr-only">{userName}</span>
        </Link>
      </div>
    </header>
  );
}
