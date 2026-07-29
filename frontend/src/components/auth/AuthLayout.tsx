import type { ReactNode } from 'react';
import { AuthBackground } from './Background';
import { FinViseLogo } from './FinViseLogo';
import { ThemeToggle } from './ThemeToggle';
import { PageContainer } from './PageContainer';
import { GlassCard } from './GlassCard';
import { cn } from '@/lib/utils';

interface AuthLayoutProps {
  children: ReactNode;
  theme?: 'dark' | 'light';
  onThemeToggle?: () => void;
}

export function AuthLayout({ children, theme = 'dark', onThemeToggle }: AuthLayoutProps) {
  return (
    <PageContainer className={theme === 'dark' ? 'dark' : 'light'}>
      <AuthBackground />
      <div className="relative z-10 mx-auto w-full max-w-[1920px]">
        <header className="relative mx-auto mb-2 w-full max-w-lg sm:mb-3">
          <div className="flex w-full justify-center">
            <FinViseLogo
              className="gap-3"
              iconClassName="h-12 w-12 rounded-2xl sm:h-14 sm:w-14"
              textClassName="text-[26px] sm:text-[32px]"
              subtitleClassName="text-xs sm:text-sm"
            />
          </div>
          {onThemeToggle ? (
            <div className="absolute right-0 top-0">
              <ThemeToggle theme={theme} onToggle={onThemeToggle} />
            </div>
          ) : null}
        </header>

        <main className="mx-auto w-full max-w-lg">
          {children}
        </main>
      </div>
    </PageContainer>
  );
}

interface AuthCardProps {
  children: ReactNode;
  className?: string;
}

export function AuthLayoutCard({ children, className }: AuthCardProps) {
  return <GlassCard className={cn('mx-auto w-full max-w-lg', className)}>{children}</GlassCard>;
}