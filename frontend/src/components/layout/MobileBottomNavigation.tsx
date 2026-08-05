import { NavLink } from 'react-router-dom';
import { LayoutDashboard, List, Upload, MessageSquare, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/auth/ThemeProvider';

interface MobileBottomNavigationProps {
  onMoreClick: () => void;
  isMoreOpen: boolean;
}

const items = [
  { to: '/', label: 'Início', icon: LayoutDashboard, end: true },
  { to: '/transactions', label: 'Transações', icon: List },
  { to: '/import', label: 'Importar', icon: Upload },
  { to: '/agent', label: 'Assistente', icon: MessageSquare },
];

export function MobileBottomNavigation({ onMoreClick, isMoreOpen }: MobileBottomNavigationProps) {
  const { resolvedTheme } = useTheme();
  const itemClass = 'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500';

  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        'mobile-safe-bottom fixed inset-x-0 bottom-0 z-30 border-t px-2 pt-1.5 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur-xl lg:hidden',
        resolvedTheme === 'dark'
          ? 'border-white/10 bg-[rgba(7,14,26,0.82)] text-white shadow-[0_-10px_30px_rgba(2,8,23,0.32)]'
          : 'border-slate-200/80 bg-[rgba(248,250,252,0.84)] text-slate-900'
      )}
    >
      <div className="mx-auto flex h-14 max-w-lg items-stretch gap-0.5">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                itemClass,
                isActive
                  ? resolvedTheme === 'dark'
                    ? 'bg-cyan-400/12 text-cyan-100'
                    : 'bg-primary-50 text-primary-700'
                  : resolvedTheme === 'dark'
                    ? 'text-slate-300'
                    : 'text-slate-500'
              )
            }
          >
            <Icon className="h-5 w-5" strokeWidth={1.9} />
            <span className="w-full truncate text-center">{label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          onClick={onMoreClick}
          aria-label="Abrir mais opções"
          aria-expanded={isMoreOpen}
          className={cn(
            itemClass,
            isMoreOpen
              ? resolvedTheme === 'dark'
                ? 'bg-cyan-400/12 text-cyan-100'
                : 'bg-primary-50 text-primary-700'
              : resolvedTheme === 'dark'
                ? 'text-slate-300'
                : 'text-slate-500'
          )}
        >
          <Menu className="h-5 w-5" strokeWidth={1.9} />
          <span>Mais</span>
        </button>
      </div>
    </nav>
  );
}
