import { Bell, ChevronRight, Menu, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/components/auth/ThemeProvider';
import { cn } from '@/lib/utils';
import { getInitials } from '@/lib/utils';

interface HeaderProps {
  userName?: string;
  onMenuClick?: () => void;
}

export function Header({ userName = 'Usuário', onMenuClick }: HeaderProps) {
  const { resolvedTheme } = useTheme();
  const initials = getInitials(userName);

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

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="Notificações">
          <Bell className={cn('h-5 w-5', resolvedTheme === 'dark' ? 'text-slate-200' : 'text-slate-600')} />
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
