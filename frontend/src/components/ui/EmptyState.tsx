import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/auth/useTheme';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  const { resolvedTheme } = useTheme();

  return (
    <section
      className={cn(
        'flex w-full flex-col items-center justify-center px-5 text-center',
        compact
          ? 'min-h-64 py-10'
          : 'min-h-[15.5rem] py-5 sm:min-h-[clamp(22rem,50dvh,34rem)] sm:py-12',
        className,
      )}
      aria-live="polite"
    >
      <div className={cn('flex h-14 w-14 items-center justify-center rounded-2xl', resolvedTheme === 'dark' ? 'bg-white/6 text-slate-300' : 'bg-slate-100 text-slate-500')}>
        <Icon className="h-7 w-7" aria-hidden="true" />
      </div>
      <h2 className={cn('mt-4 text-lg font-semibold', resolvedTheme === 'dark' ? 'text-white' : 'text-slate-900')}>{title}</h2>
      {description && (
        <p className={cn('mt-1 max-w-md text-sm leading-6', resolvedTheme === 'dark' ? 'text-slate-300' : 'text-slate-500')}>{description}</p>
      )}
      {action && <div className="mt-6 w-full max-w-lg">{action}</div>}
    </section>
  );
}
