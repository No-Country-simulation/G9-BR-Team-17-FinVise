import type { ReactNode } from 'react';
import { AuthBackground } from './Background';
import { FinViseMark } from './FinViseLogo';
import { ThemeToggle } from './ThemeToggle';
import { GlassCard } from './GlassCard';
import { useTheme } from './useTheme';
import { cn } from '@/lib/utils';

interface AuthLayoutProps {
  children: ReactNode;
  theme?: 'dark' | 'light';
  onThemeToggle?: () => void;
  variant?: 'default' | 'split' | 'reverse' | 'focus';
  aside?: ReactNode;
}

interface AuthBrandProps {
  theme: 'dark' | 'light';
  centered?: boolean;
}

function AuthBrand({ theme, centered = false }: AuthBrandProps) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5 sm:gap-3', centered && 'justify-center')}>
      <FinViseMark className="h-12 w-12 shrink-0 sm:h-14 sm:w-14" theme={theme} />
      <div className="min-w-0">
        <p className="auth-wordmark text-[2rem] leading-none sm:text-[2.25rem]">
          <span className={theme === 'dark' ? 'text-slate-50' : 'text-slate-950'}>Fin</span>
          <span className={theme === 'dark' ? 'text-slate-50' : 'text-slate-950'}>Vise</span>
        </p>
      </div>
    </div>
  );
}

export function AuthLayout({
  children,
  theme: themeOverride,
  onThemeToggle,
  variant = 'default',
  aside,
}: AuthLayoutProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const theme = themeOverride ?? resolvedTheme;
  const hasVisualPanel = variant !== 'default' && Boolean(aside);
  const toggleTheme = onThemeToggle ?? (() => setTheme(theme === 'dark' ? 'light' : 'dark'));

  return (
    <div
      className={cn(
        'auth-shell relative min-h-dvh w-full overflow-x-hidden',
        theme === 'dark' ? 'dark text-white' : 'light text-slate-950'
      )}
      data-theme={theme}
      data-auth-variant={variant}
    >
      <AuthBackground />

      {variant !== 'split' ? (
        <header className="relative z-20 mx-auto flex min-h-[4.5rem] w-full max-w-[1680px] items-center justify-between gap-4 px-4 py-3 sm:min-h-20 sm:px-7 lg:px-10 xl:px-14">
          <AuthBrand theme={theme} />
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </header>
      ) : null}

      <div
        className={cn(
          'relative z-10 mx-auto grid w-full max-w-[1680px] px-3 pb-8 sm:px-6 lg:min-h-[calc(100dvh-6rem)] lg:px-10 lg:pb-10 xl:px-14',
          variant === 'split' && 'min-h-dvh items-center gap-4 sm:gap-7 lg:min-h-dvh xl:grid-cols-[minmax(28rem,0.88fr)_minmax(34rem,1.12fr)] xl:gap-14',
          variant === 'reverse' && 'items-center gap-4 sm:gap-7 xl:grid-cols-[minmax(28rem,1fr)_minmax(28rem,1fr)] xl:gap-14',
          variant === 'focus' && 'max-w-[1240px] items-center gap-4 sm:gap-7 xl:grid-cols-[minmax(19rem,0.72fr)_minmax(28rem,0.9fr)] xl:gap-12',
          variant === 'default' && 'place-items-center'
        )}
      >
        <section
          className={cn(
            'order-2 flex w-full min-w-0 justify-center py-3 sm:py-6 lg:py-8',
            variant === 'split' && 'xl:order-1 xl:justify-start',
            variant === 'reverse' && 'xl:order-2 xl:justify-end',
            variant === 'focus' && 'xl:order-2 xl:justify-end',
            variant === 'default' && 'max-w-xl'
          )}
        >
          <div className={cn('w-full', variant === 'focus' && 'max-w-[32rem]', variant === 'reverse' && 'max-w-[40rem]', variant === 'split' && 'max-w-[34rem]', variant === 'default' && 'max-w-[34rem]')}>
            {variant === 'split' ? (
              <div className="mb-4 flex min-h-14 w-full items-center justify-center sm:mb-5">
                <AuthBrand theme={theme} centered />
              </div>
            ) : null}
            <main className="w-full">{children}</main>
            {variant === 'split' ? (
              <div className="mt-2 flex w-full justify-end px-1">
                <ThemeToggle
                  theme={theme}
                  onToggle={toggleTheme}
                  className="h-9 min-w-9 border-transparent bg-transparent px-2 shadow-none hover:translate-y-0"
                />
              </div>
            ) : null}
          </div>
        </section>

        {hasVisualPanel ? (
          <aside
            className={cn(
              'order-1 hidden min-h-0 w-full self-stretch xl:block',
              variant === 'split' && 'xl:order-2',
              variant === 'reverse' && 'xl:order-1',
              variant === 'focus' && 'xl:order-1 xl:self-center'
            )}
          >
            {aside}
          </aside>
        ) : null}
      </div>
    </div>
  );
}

interface AuthCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export function AuthLayoutCard({ children, className, ...props }: AuthCardProps) {
  return (
    <GlassCard className={cn('mx-auto w-full', className)} {...props}>
      {children}
    </GlassCard>
  );
}
