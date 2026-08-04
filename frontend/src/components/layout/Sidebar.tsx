import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  List,
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
import { useTheme } from '@/components/auth/ThemeProvider';

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
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
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
          'fixed left-0 top-0 z-50 flex h-dvh w-[min(18rem,calc(100vw-2.5rem))] transform flex-col border-r backdrop-blur-xl transition-transform duration-300 ease-out lg:w-64 lg:translate-x-0 lg:shadow-none',
          resolvedTheme === 'dark'
            ? 'border-white/10 bg-[rgba(7,14,26,0.82)] text-white shadow-[0_28px_80px_rgba(2,8,23,0.42)]'
            : 'border-slate-200/80 bg-[rgba(248,250,252,0.84)] text-slate-900 shadow-[0_28px_80px_rgba(15,23,42,0.10)]',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className={cn('mobile-safe-top flex min-h-16 items-center justify-between border-b px-5 lg:px-6', resolvedTheme === 'dark' ? 'border-white/10' : 'border-slate-200')}>
          <span className={cn('text-xl font-bold', resolvedTheme === 'dark' ? 'text-cyan-200' : 'text-primary-600')}>FinVise</span>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose} aria-label="Fechar menu">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
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
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className={cn('shrink-0 border-t p-4', resolvedTheme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white/70')}>
          <button
            onClick={handleLogout}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              resolvedTheme === 'dark'
                ? 'text-slate-300 hover:bg-red-500/10 hover:text-red-200'
                : 'text-slate-600 hover:bg-red-50 hover:text-red-700'
            )}
          >
            <LogOut className="h-5 w-5" />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
