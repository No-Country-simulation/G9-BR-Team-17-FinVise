import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  List,
  Menu,
  FileClock,
  FileUp,
  Database,
  Lightbulb,
  History,
  MessageSquare,
  LogOut,
  X,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { authService } from '@/services/authService';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/components/auth/useTheme';
import { FinViseMark } from '@/components/auth/FinViseLogo';

const mainNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/transactions', icon: List, label: 'Transações' },
  { to: '/analyses', icon: FileClock, label: 'Histórico de análises', end: true },
  { to: '/history', icon: History, label: 'Histórico mensal' },
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
  'flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50';

const submenuPanelClass =
  'ml-[1.15rem] overflow-hidden border-l pl-2.5 transition-[max-height,opacity,transform,margin] duration-200 ease-out';

const submenuLinkClass =
  'flex min-h-9 items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50';

interface SubmenuItem {
  to: string;
  icon: LucideIcon;
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
        isOpen ? 'mt-0.5 max-h-28 translate-y-0 opacity-100' : 'pointer-events-none max-h-0 -translate-y-1 opacity-0'
      )}
    >
      <div className="flex flex-col gap-0.5 py-1">
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
                    ? 'bg-[rgba(255,255,255,0.09)] text-white'
                    : 'bg-slate-200/90 text-slate-950 shadow-sm'
                  : resolvedTheme === 'dark'
                    ? 'text-slate-400 hover:bg-[rgba(255,255,255,0.055)] hover:text-slate-100'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
            <span className="truncate !text-inherit">{item.label}</span>
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
  const [isImportOpen, setIsImportOpen] = useState(() => pathname.startsWith('/import'));
  const [isInsightsOpen, setIsInsightsOpen] = useState(() => pathname.startsWith('/recommendations') || pathname.startsWith('/agent'));
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() =>
    window.matchMedia('(min-width: 1024px)').matches
  );
  const sidebarRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const logoutDialogRef = useRef<HTMLDivElement>(null);
  const logoutCancelButtonRef = useRef<HTMLButtonElement>(null);

  const activeGroup = useMemo(() => {
    if (pathname.startsWith('/import')) return 'import';
    if (pathname.startsWith('/recommendations') || pathname.startsWith('/agent')) return 'insights';
    return null;
  }, [pathname]);

  useEffect(() => {
    if (activeGroup === 'import') {
      setIsImportOpen(true);
      setIsInsightsOpen(false);
    }
    if (activeGroup === 'insights') {
      setIsInsightsOpen(true);
      setIsImportOpen(false);
    }
  }, [activeGroup]);

  const toggleImportMenu = () => {
    const shouldOpen = !isImportOpen;
    setIsImportOpen(shouldOpen);
    if (shouldOpen) setIsInsightsOpen(false);
  };

  const toggleInsightsMenu = () => {
    const shouldOpen = !isInsightsOpen;
    setIsInsightsOpen(shouldOpen);
    if (shouldOpen) setIsImportOpen(false);
  };

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 1024px)');
    const updateViewport = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsDesktopViewport(event.matches);
    };

    updateViewport(desktopQuery);
    desktopQuery.addEventListener('change', updateViewport);
    return () => desktopQuery.removeEventListener('change', updateViewport);
  }, []);

  useEffect(() => {
    if (!isOpen || isLogoutConfirmOpen) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !sidebarRef.current) return;

      const focusableElements = Array.from(
        sidebarRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => element.offsetParent !== null);
      if (focusableElements.length === 0) return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', keepFocusInside);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', keepFocusInside);
      previouslyFocused?.focus();
    };
  }, [isLogoutConfirmOpen, isOpen]);

  useEffect(() => {
    if (!isLogoutConfirmOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const frame = window.requestAnimationFrame(() => logoutCancelButtonRef.current?.focus());
    const handleDialogKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsLogoutConfirmOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !logoutDialogRef.current) return;

      const focusableElements = Array.from(
        logoutDialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')
      ).filter((element) => element.offsetParent !== null);
      if (focusableElements.length === 0) return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleDialogKeyboard);

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleDialogKeyboard);
      previouslyFocused?.focus();
    };
  }, [isLogoutConfirmOpen]);

  const handleLogout = () => {
    authService.logout();
    window.location.href = '/login';
  };

  return (
    <>
      <button
        type="button"
        aria-label="Fechar menu"
        aria-hidden={!isOpen}
        tabIndex={isOpen ? 0 : -1}
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
      />
      <aside
        id="app-sidebar"
        ref={sidebarRef}
        inert={!isOpen && !isDesktopViewport ? true : undefined}
        role={isOpen && !isDesktopViewport ? 'dialog' : undefined}
        aria-modal={isOpen && !isDesktopViewport ? 'true' : undefined}
        aria-label="Menu principal"
        className={cn(
          'fixed left-0 top-0 z-50 flex h-dvh w-[min(18rem,calc(100vw-2.5rem))] transform flex-col border-r backdrop-blur-xl transition-[width,transform] duration-300 ease-out lg:translate-x-0 lg:shadow-none',
          resolvedTheme === 'dark'
            ? 'border-white/10 bg-[rgba(7,13,23,0.94)] text-white shadow-[18px_0_48px_rgba(2,8,23,0.32)]'
            : 'border-slate-200/80 bg-[rgba(248,250,252,0.84)] text-slate-900 shadow-[0_28px_80px_rgba(15,23,42,0.10)]',
          isCollapsed ? 'lg:w-[4.5rem]' : 'lg:w-60',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className={cn('mobile-safe-top border-b px-3', resolvedTheme === 'dark' ? 'border-white/8' : 'border-slate-200')}>
          <div className={cn('hidden h-16 w-full items-center justify-center', isCollapsed && 'lg:flex')}>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              aria-label="Expandir menu lateral"
              aria-pressed="true"
              title="Expandir menu lateral"
            >
              <Menu className="h-[18px] w-[18px]" />
            </Button>
          </div>
          <div className={cn('h-16 items-center justify-between', isCollapsed ? 'flex lg:hidden' : 'flex')}>
            <div className="flex min-w-0 items-center gap-2.5 overflow-hidden transition-all duration-300">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center bg-transparent shadow-none transition-all duration-300"
              >
                <FinViseMark className="h-8 w-8" theme={resolvedTheme} />
              </div>
              <div className="min-w-0 max-w-[10rem] translate-x-0 overflow-hidden whitespace-nowrap opacity-100 transition-all duration-300 ease-out">
                <span
                  className={cn(
                    'block text-[1.35rem] font-semibold tracking-[-0.035em]',
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
                <Menu className="h-[18px] w-[18px]" />
              </Button>
              <Button
                ref={closeButtonRef}
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={onClose}
                aria-label="Fechar menu"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        <nav className={cn('flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-3', isCollapsed && 'lg:px-2.5')}>
          <div className="flex flex-col gap-0.5">
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
                    'flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50',
                    isCollapsed && 'lg:justify-center lg:px-0',
                    isActive
                      ? resolvedTheme === 'dark'
                        ? 'bg-[rgba(255,255,255,0.09)] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]'
                        : 'bg-slate-200/90 text-slate-950 shadow-sm'
                      : resolvedTheme === 'dark'
                        ? 'text-slate-400 hover:bg-[rgba(255,255,255,0.055)] hover:text-slate-100'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                  )
                }
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
                <span className={cn('truncate !text-inherit', isCollapsed && 'lg:hidden')}>{item.label}</span>
              </NavLink>
            ))}
          </div>

          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={toggleImportMenu}
              aria-expanded={isImportOpen}
              aria-label="Alternar submenu de importações"
              className={cn(
                submenuToggleClass,
                isCollapsed && 'lg:justify-center lg:px-0',
                activeGroup === 'import'
                  ? resolvedTheme === 'dark'
                    ? 'text-white'
                    : 'text-slate-950'
                  : resolvedTheme === 'dark'
                    ? 'text-slate-400 hover:bg-[rgba(255,255,255,0.055)] hover:text-slate-100'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
              )}
            >
              <FileUp className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
              <span className={cn('truncate !text-inherit', isCollapsed && 'lg:hidden')}>Importações</span>
              <ChevronRight className={cn('ml-auto h-3.5 w-3.5 transition-transform duration-150', isCollapsed && 'hidden', isImportOpen && 'rotate-90')} />
            </button>
            <SubmenuPanel
              isOpen={isImportOpen}
              isCollapsed={isCollapsed}
              items={importNavItems}
              resolvedTheme={resolvedTheme}
              onClose={onClose}
            />
          </div>

          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={toggleInsightsMenu}
              aria-expanded={isInsightsOpen}
              aria-label="Alternar submenu de IA e insights"
              className={cn(
                submenuToggleClass,
                isCollapsed && 'lg:justify-center lg:px-0',
                activeGroup === 'insights'
                  ? resolvedTheme === 'dark'
                    ? 'text-white'
                    : 'text-slate-950'
                  : resolvedTheme === 'dark'
                    ? 'text-slate-400 hover:bg-[rgba(255,255,255,0.055)] hover:text-slate-100'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
              )}
            >
              <Lightbulb className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
              <span className={cn('truncate !text-inherit', isCollapsed && 'lg:hidden')}>IA e insights</span>
              <ChevronRight className={cn('ml-auto h-3.5 w-3.5 transition-transform duration-150', isCollapsed && 'hidden', isInsightsOpen && 'rotate-90')} />
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

        <div
          className={cn(
            'shrink-0 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]',
            resolvedTheme === 'dark' ? 'border-white/8' : 'border-slate-200',
            isCollapsed && 'lg:px-2.5'
          )}
        >
          <button
            onClick={() => setIsLogoutConfirmOpen(true)}
            aria-label="Sair"
            title={isCollapsed ? 'Sair' : undefined}
            className={cn(
              'flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
              isCollapsed && 'lg:justify-center lg:px-0',
              resolvedTheme === 'dark'
                ? 'text-slate-400 hover:bg-red-500/10 hover:text-red-200'
                : 'text-slate-600 hover:bg-red-50 hover:text-red-700'
            )}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
            <span className={cn('!text-inherit', isCollapsed && 'lg:hidden')}>Sair</span>
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
            ref={logoutDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-confirm-title"
            aria-describedby="logout-confirm-description"
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
                <p id="logout-confirm-description" className={cn('mt-2 text-sm leading-relaxed', resolvedTheme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                  Você deseja realmente sair da sua conta agora?
                </p>
              </div>
            </div>

            <div className="relative mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                ref={logoutCancelButtonRef}
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
