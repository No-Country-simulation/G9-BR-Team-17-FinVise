import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  List,
  Menu,
  PlusCircle,
  FileUp,
  Database,
  Lightbulb,
  History,
  MessageSquare,
  LogOut,
  X,
  ChevronDown,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { authService } from '@/services/authService';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/components/auth/useTheme';
import { FinViseMark } from '@/components/auth/FinViseLogo';

const mainNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/transactions', icon: List, label: 'Transações' },
  { to: '/analyses/new', icon: PlusCircle, label: 'Nova Análise' },
  { to: '/history', icon: History, label: 'Histórico' },
];

const importNavItems = [
  { to: '/import', icon: FileUp, label: 'Importar transações' },
  { to: '/import/sources', icon: Database, label: 'Fontes importadas' },
];

const insightNavItems = [
  { to: '/recommendations', icon: Lightbulb, label: 'Recomendações' },
  { to: '/agent', icon: MessageSquare, label: 'Assistente' },
];

const submenuToggleClass =
  'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50';

const submenuPanelClass =
  'ml-3 overflow-hidden border-l pl-3 transition-all duration-300 ease-out';

const submenuLinkClass =
  'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50 focus-visible:translate-x-0.5';

interface SubmenuItem {
  to: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
}

interface SubmenuPanelProps {
  isOpen: boolean;
  isCollapsed: boolean;
  items: SubmenuItem[];
  resolvedTheme: 'dark' | 'light';
  onClose: () => void;
}

function SubmenuPanel({ isOpen, isCollapsed, items, resolvedTheme, onClose }: SubmenuPanelProps) {
  return (
    <div
      className={cn(
        submenuPanelClass,
        resolvedTheme === 'dark' ? 'border-white/10' : 'border-slate-200',
        isCollapsed && 'lg:hidden',
        isOpen ? 'mt-1 max-h-40 translate-y-0 opacity-100' : 'pointer-events-none max-h-0 -translate-y-1 opacity-0'
      )}
    >
      <div className="flex flex-col gap-1 py-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            onClick={onClose}
            aria-label={item.label}
            className={({ isActive }) =>
              cn(
                submenuLinkClass,
                isActive
                  ? resolvedTheme === 'dark'
                    ? 'bg-cyan-400/12 text-cyan-100'
                    : 'bg-primary-50 text-primary-700'
                  : resolvedTheme === 'dark'
                    ? 'text-slate-300 hover:translate-x-0.5 hover:bg-cyan-400/10 hover:text-white'
                    : 'text-slate-600 hover:translate-x-0.5 hover:bg-slate-100 hover:text-slate-900'
              )
            }
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ isOpen, onClose, isCollapsed, onToggleCollapse }: SidebarProps) {
  const { resolvedTheme } = useTheme();
  const { pathname } = useLocation();
  const [isImportOpen, setIsImportOpen] = useState(true);
  const [isInsightsOpen, setIsInsightsOpen] = useState(true);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  const activeGroup = useMemo(() => {
    if (pathname.startsWith('/import')) return 'import';
    if (pathname.startsWith('/recommendations') || pathname.startsWith('/agent')) return 'insights';
    return null;
  }, [pathname]);

  useEffect(() => {
    if (activeGroup === 'import') setIsImportOpen(true);
    if (activeGroup === 'insights') setIsInsightsOpen(true);
  }, [activeGroup]);

  useEffect(() => {
    if (!isLogoutConfirmOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsLogoutConfirmOpen(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isLogoutConfirmOpen]);

  const handleLogout = () => {
    authService.logout();
    window.location.href = '/login';
  };

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-dvh w-[min(18rem,calc(100vw-2.5rem))] transform flex-col border-r backdrop-blur-xl transition-[width,transform] duration-300 ease-out lg:translate-x-0 lg:shadow-none',
          resolvedTheme === 'dark'
            ? 'border-white/10 bg-[rgba(7,14,26,0.82)] text-white shadow-[0_28px_80px_rgba(2,8,23,0.42)]'
            : 'border-slate-200/80 bg-[rgba(248,250,252,0.84)] text-slate-900 shadow-[0_28px_80px_rgba(15,23,42,0.10)]',
          isCollapsed ? 'lg:w-[5.5rem]' : 'lg:w-64',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className={cn('mobile-safe-top border-b px-4 lg:px-4', resolvedTheme === 'dark' ? 'border-white/10' : 'border-slate-200')}>
          {isCollapsed ? (
            <div className="hidden min-h-20 w-full flex-col items-center justify-center gap-2 py-2 lg:flex">
              <div
                className="flex h-14 w-14 items-center justify-center bg-transparent shadow-none transition-all duration-300"
              >
                <FinViseMark className="h-11 w-11" theme={resolvedTheme} />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleCollapse}
                aria-label="Expandir menu lateral"
                aria-pressed="true"
                title="Expandir menu lateral"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>
          ) : (
            <div className="flex min-h-16 items-center justify-between">
              <div className="flex min-w-0 items-center gap-3 overflow-hidden transition-all duration-300">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center bg-transparent shadow-none transition-all duration-300"
                >
                  <FinViseMark className="h-11 w-11" theme={resolvedTheme} />
                </div>
                <div className="min-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 ease-out max-w-[10rem] opacity-100 translate-x-0">
                  <span
                    className={cn(
                      'block text-[1.65rem] font-semibold tracking-tight',
                      resolvedTheme === 'dark' ? 'text-white' : 'text-slate-900'
                    )}
                  >
                    FinVise
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden lg:inline-flex"
                  onClick={onToggleCollapse}
                  aria-label="Recolher menu lateral"
                  aria-pressed="false"
                  title="Recolher menu lateral"
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose} aria-label="Fechar menu">
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <nav className={cn('flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4', isCollapsed && 'lg:px-3')}>
          <div className="flex flex-col gap-1">
            <p className={cn('px-3 text-[11px] font-semibold uppercase tracking-[0.18em]', resolvedTheme === 'dark' ? 'text-slate-500' : 'text-slate-400', isCollapsed && 'lg:hidden')}>
              Principal
            </p>
            {mainNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onClose}
                aria-label={item.label}
                title={isCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50',
                    isCollapsed && 'lg:justify-center lg:px-0',
                    isActive
                      ? resolvedTheme === 'dark'
                        ? 'bg-cyan-400/12 text-cyan-100'
                        : 'bg-primary-50 text-primary-700'
                      : resolvedTheme === 'dark'
                        ? 'text-slate-300 hover:bg-cyan-400/10 hover:text-white hover:translate-x-0.5'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 hover:translate-x-0.5'
                  )
                }
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className={cn('truncate', isCollapsed && 'lg:hidden')}>{item.label}</span>
              </NavLink>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => setIsImportOpen((current) => !current)}
              aria-expanded={isImportOpen}
              aria-label="Alternar submenu de importações"
              className={cn(
                submenuToggleClass,
                isCollapsed && 'lg:justify-center lg:px-0',
                activeGroup === 'import'
                  ? resolvedTheme === 'dark'
                    ? 'bg-cyan-400/12 text-cyan-100'
                    : 'bg-primary-50 text-primary-700'
                  : resolvedTheme === 'dark'
                    ? 'text-slate-300 hover:bg-cyan-400/10 hover:text-white hover:translate-x-0.5'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 hover:translate-x-0.5'
              )}
            >
              <FileUp className="h-5 w-5 shrink-0" />
              <span className={cn('truncate', isCollapsed && 'lg:hidden')}>Importações</span>
              <ChevronDown className={cn('ml-auto h-4 w-4 transition-transform duration-200', isCollapsed && 'hidden', isImportOpen ? 'rotate-180' : 'rotate-0')} />
            </button>
            <SubmenuPanel
              isOpen={isImportOpen}
              isCollapsed={isCollapsed}
              items={importNavItems}
              resolvedTheme={resolvedTheme}
              onClose={onClose}
            />
          </div>

          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => setIsInsightsOpen((current) => !current)}
              aria-expanded={isInsightsOpen}
              aria-label="Alternar submenu de IA e insights"
              className={cn(
                submenuToggleClass,
                isCollapsed && 'lg:justify-center lg:px-0',
                activeGroup === 'insights'
                  ? resolvedTheme === 'dark'
                    ? 'bg-cyan-400/12 text-cyan-100'
                    : 'bg-primary-50 text-primary-700'
                  : resolvedTheme === 'dark'
                    ? 'text-slate-300 hover:bg-cyan-400/10 hover:text-white hover:translate-x-0.5'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 hover:translate-x-0.5'
              )}
            >
              <Lightbulb className="h-5 w-5 shrink-0" />
              <span className={cn('truncate', isCollapsed && 'lg:hidden')}>IA e insights</span>
              <ChevronDown className={cn('ml-auto h-4 w-4 transition-transform duration-200', isCollapsed && 'hidden', isInsightsOpen ? 'rotate-180' : 'rotate-0')} />
            </button>
            <SubmenuPanel
              isOpen={isInsightsOpen}
              isCollapsed={isCollapsed}
              items={insightNavItems}
              resolvedTheme={resolvedTheme}
              onClose={onClose}
            />
          </div>
        </nav>

        <div className={cn('shrink-0 border-t p-4', resolvedTheme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white/70', isCollapsed && 'lg:px-3')}>
          <button
            onClick={() => setIsLogoutConfirmOpen(true)}
            aria-label="Sair"
            title={isCollapsed ? 'Sair' : undefined}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isCollapsed && 'lg:justify-center lg:px-0',
              resolvedTheme === 'dark'
                ? 'text-slate-300 hover:bg-red-500/10 hover:text-red-200'
                : 'text-slate-600 hover:bg-red-50 hover:text-red-700'
            )}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span className={cn(isCollapsed && 'lg:hidden')}>Sair</span>
          </button>
        </div>
      </aside>

      {isLogoutConfirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-3 backdrop-blur-sm sm:items-center sm:p-6">
          <div className={cn('absolute inset-0', resolvedTheme === 'dark' ? 'bg-slate-950/55' : 'bg-slate-950/35')} />
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Fechar confirmação de saída"
            onClick={() => setIsLogoutConfirmOpen(false)}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-confirm-title"
            className={cn(
              'relative w-full max-w-lg overflow-hidden rounded-[30px] border p-6 shadow-[0_24px_70px_rgba(0,0,0,0.45)] sm:p-7',
              resolvedTheme === 'dark'
                ? 'border-white/20 bg-[linear-gradient(180deg,rgba(8,15,28,0.98)_0%,rgba(5,12,25,0.97)_100%)]'
                : 'border-cyan-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(241,245,249,0.98)_100%)]'
            )}
          >
            <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl" aria-hidden="true" />
            <div className="pointer-events-none absolute -bottom-20 -left-20 h-52 w-52 rounded-full bg-emerald-300/15 blur-3xl" aria-hidden="true" />

            <div className="relative flex items-start gap-4">
              <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border', resolvedTheme === 'dark' ? 'border-red-200/30 bg-red-500/20 text-red-100' : 'border-red-200 bg-red-50 text-red-600')}>
                <LogOut className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h2 id="logout-confirm-title" className={cn('text-xl font-bold tracking-tight', resolvedTheme === 'dark' ? 'text-slate-50' : 'text-slate-900')}>
                  Confirmar saída
                </h2>
                <p className={cn('mt-2 text-sm leading-relaxed', resolvedTheme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                  Você deseja realmente sair da sua conta agora?
                </p>
              </div>
            </div>

            <div className="relative mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setIsLogoutConfirmOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                className="w-full sm:w-auto"
                onClick={handleLogout}
              >
                Sair agora
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
