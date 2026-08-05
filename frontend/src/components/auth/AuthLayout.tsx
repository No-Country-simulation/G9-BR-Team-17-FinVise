import type { ReactNode } from 'react';
import { AuthBackground } from './Background';
import { FinViseMark } from './FinViseLogo';
import { ThemeToggle } from './ThemeToggle';
import { PageContainer } from './PageContainer';
import { GlassCard } from './GlassCard';
import { cn } from '@/lib/utils';

interface AuthLayoutProps {
  children: ReactNode;
  theme?: 'dark' | 'light';
  onThemeToggle?: () => void;
  variant?: 'default' | 'split';
  aside?: ReactNode;
}

export function AuthLayout({
  children,
  theme = 'dark',
  onThemeToggle,
  variant = 'default',
  aside,
}: AuthLayoutProps) {
  if (variant === 'split') {
    return (
      <div
        className={cn('auth-shell relative h-dvh w-screen overflow-hidden', theme === 'dark' ? 'dark' : 'light')}
        data-theme={theme}
      >
        <AuthBackground />

        <section className="absolute left-4 top-4 z-20 flex items-center gap-4 sm:left-6 sm:top-5 lg:left-8 lg:top-6">
          <div
            className={cn(
              'flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl',
              theme === 'dark' ? 'border border-white/10 bg-white/10' : 'border border-slate-200 bg-white/90'
            )}
          >
            <FinViseMark className="h-10 w-10 object-cover" />
          </div>

          <div className="text-left">
            <p className="text-[34px] font-semibold leading-none tracking-[-0.02em] sm:text-[44px]">
              <span className="text-cyan-300">Fin</span>
              <span className="text-white">Vise</span>
            </p>
            <p className="mt-0.5 text-xs text-slate-300 sm:text-sm">Inteligência financeira simplificada</p>
          </div>

          {onThemeToggle ? (
            <div className="ml-4">
              <ThemeToggle theme={theme} onToggle={onThemeToggle} />
            </div>
          ) : null}
        </section>

        <div className="relative z-10 mx-auto grid h-full w-full max-w-[2000px] items-stretch gap-6 px-4 py-3 sm:px-6 sm:py-4 lg:grid-cols-2 lg:gap-9 lg:px-8 lg:py-5 lg:[--auth-card-h:clamp(500px,calc(50dvh-176px),680px)] lg:[--auth-aside-offset:clamp(121.1px,16dvh,150px)]">
          <section className="mx-auto flex min-h-0 w-full max-w-[640px] flex-col justify-center">
            <header className="mb-3 flex items-center gap-3 sm:mb-4 opacity-0 pointer-events-none" aria-hidden="true">
              <div
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl',
                  theme === 'dark' ? 'border border-white/10 bg-white/10' : 'border border-slate-200 bg-white/90'
                )}
              >
                <FinViseMark className="h-8 w-8 object-cover" />
              </div>

              <div className="text-left">
                <p className="text-[34px] font-semibold leading-none tracking-[-0.02em] sm:text-[44px]">
                  <span className="text-cyan-300">Fin</span>
                  <span className="text-white">Vise</span>
                </p>
                <p className="mt-1 text-xs text-slate-300 sm:text-sm">Inteligência financeira simplificada</p>
              </div>

              {onThemeToggle ? <div className="ml-auto" /> : null}
            </header>

            <main className="w-full min-h-0 lg:h-[var(--auth-card-h)]">{children}</main>
          </section>

          {aside ? <aside className="mx-auto hidden min-h-0 w-full max-w-[640px] lg:mt-[var(--auth-aside-offset)] lg:h-[var(--auth-card-h)] lg:block">{aside}</aside> : null}
        </div>
      </div>
    );
  }

  return (
    <PageContainer className={theme === 'dark' ? 'dark' : 'light'}>
      <AuthBackground />
      <div className="relative z-10 mx-auto w-full max-w-[1920px]">
        <header className="relative mx-auto mb-2 w-full max-w-lg sm:mb-3">
          <div className="flex w-full justify-center">
            <div className="text-center">
              <p className="text-[34px] font-semibold tracking-[-0.02em] sm:text-[44px]">
                <span className="text-cyan-300">Fin</span>
                <span className="text-white">Vise</span>
              </p>
              <p className="text-xs text-slate-300 sm:text-sm">Inteligência financeira simplificada</p>
            </div>
          </div>
          {onThemeToggle ? (
            <div className="absolute right-0 top-0">
              <ThemeToggle theme={theme} onToggle={onThemeToggle} />
            </div>
          ) : null}
        </header>

        <main className="mx-auto w-full max-w-lg">{children}</main>
      </div>
    </PageContainer>
  );
}

interface AuthCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export function AuthLayoutCard({ children, className, ...props }: AuthCardProps) {
  return (
    <GlassCard className={cn('mx-auto w-full max-w-[640px]', className)} {...props}>
      {children}
    </GlassCard>
  );
}