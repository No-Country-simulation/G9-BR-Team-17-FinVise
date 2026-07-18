import { Bell, Menu, User } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getInitials } from '@/lib/utils';

interface HeaderProps {
  userName?: string;
  onMenuClick?: () => void;
}

export function Header({ userName = 'Usuário', onMenuClick }: HeaderProps) {
  return (
    <header className="mobile-safe-top sticky top-0 z-30 flex min-h-16 w-full min-w-0 items-center justify-between border-b border-slate-200 bg-white px-3 shadow-sm sm:px-5 lg:h-16 lg:px-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="-ml-1 lg:hidden" onClick={onMenuClick} aria-label="Abrir menu">
          <Menu className="h-5 w-5" />
        </Button>
        <span className="text-base font-bold tracking-tight text-primary-700 lg:hidden">Finance AI</span>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="Notificações">
          <Bell className="h-5 w-5 text-slate-600" />
        </Button>
        <div className="flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 sm:px-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-primary-700">
            <User className="h-4 w-4" />
          </div>
          <span className="hidden text-sm font-medium text-slate-700 sm:inline">{getInitials(userName)}</span>
        </div>
      </div>
    </header>
  );
}
