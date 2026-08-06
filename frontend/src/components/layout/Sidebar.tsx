import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  List,
  Menu,
  PlusCircle,
  FileUp,
  Database,
  UserCircle,
  Lightbulb,
  History,
  MessageSquare,
  Settings,
  LogOut,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { authService } from '@/services/authService';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/components/auth/useTheme';
import { FinViseMark } from '@/components/auth/FinViseLogo';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/transactions', icon: List, label: 'Transações' },
  { to: '/analyses/new', icon: PlusCircle, label: 'Nova Análise' },
  { to: '/import', icon: FileUp, label: 'Importar transações' },
  { to: '/import/sources', icon: Database, label: 'Fontes importadas' },
  { to: '/recommendations', icon: Lightbulb, label: 'Recomendações' },
  { to: '/history', icon: History, label: 'Histórico' },
  { to: '/agent', icon: MessageSquare, label: 'Assistente' },
  { to: '/profile', icon: UserCircle, label: 'Perfil' },
  { to: '/settings', icon: Settings, label: 'Configurações' },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ isOpen, onClose, isCollapsed, onToggleCollapse }: SidebarProps) {
  const { resolvedTheme } = useTheme();

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
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-[18px] border transition-all duration-300',
                  resolvedTheme === 'dark'
                    ? 'border-white/10 bg-white/5 text-cyan-300 shadow-[0_12px_30px_rgba(0,0,0,0.18)]'
                    : 'border-primary-100 bg-white/80 text-primary-700 shadow-[0_12px_30px_rgba(15,23,42,0.08)]'
                )}
              >
                <FinViseMark className="h-8 w-8" />
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
                  className={cn(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] transition-all duration-300',
                    resolvedTheme === 'dark'
                      ? 'border border-white/10 bg-white/5 text-cyan-300 shadow-[0_12px_30px_rgba(0,0,0,0.18)]'
                      : 'border border-primary-100 bg-white/80 text-primary-700 shadow-[0_12px_30px_rgba(15,23,42,0.08)]'
                  )}
                >
                  <FinViseMark className="h-8 w-8" />
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

        <nav className={cn('flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-4', isCollapsed && 'lg:px-3')}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              onClick={onClose}
              aria-label={item.label}
              title={isCollapsed ? item.label : undefined}
              className={({ isActive }) =>
                cn(
                  'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isCollapsed && 'lg:justify-center lg:px-0',
                  isActive
                    ? resolvedTheme === 'dark'
                      ? 'bg-cyan-400/12 text-cyan-100'
                      : 'bg-primary-50 text-primary-700'
                    : resolvedTheme === 'dark'
                      ? 'text-slate-300 hover:bg-white/6 hover:text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className={cn('truncate', isCollapsed && 'lg:hidden')}>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className={cn('shrink-0 border-t p-4', resolvedTheme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white/70', isCollapsed && 'lg:px-3')}>
          <button
            onClick={handleLogout}
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
    </>
  );
}
