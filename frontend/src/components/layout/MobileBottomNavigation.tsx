import { NavLink } from 'react-router-dom';
import { LayoutDashboard, List, Upload, MessageSquare, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const itemClass = 'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500';

  return (
    <nav
      aria-label="Navegação principal"
      className="mobile-safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-2 pt-1.5 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] lg:hidden"
    >
      <div className="mx-auto flex h-14 max-w-lg items-stretch gap-0.5">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => cn(itemClass, isActive ? 'bg-primary-50 text-primary-700' : 'text-slate-500')}
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
          className={cn(itemClass, isMoreOpen ? 'bg-primary-50 text-primary-700' : 'text-slate-500')}
        >
          <Menu className="h-5 w-5" strokeWidth={1.9} />
          <span>Mais</span>
        </button>
      </div>
    </nav>
  );
}
