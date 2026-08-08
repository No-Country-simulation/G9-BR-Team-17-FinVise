import { cn } from '@/lib/utils';
import { useTheme } from './useTheme';
import finViseLogoImage from '@/assets/branding/new-logo-finvise.png';

interface FinViseLogoProps {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  subtitleClassName?: string;
  showSubtitle?: boolean;
}

interface FinViseMarkProps {
  className?: string;
  theme?: 'dark' | 'light';
}

export function FinViseMark({ className, theme }: FinViseMarkProps) {
  const { resolvedTheme } = useTheme();
  const effectiveTheme = theme ?? resolvedTheme;

  return (
    <span
      className={cn(
        'relative isolate flex items-center justify-center overflow-hidden rounded-[inherit]',
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-0 rounded-[inherit]',
          effectiveTheme === 'dark'
            ? 'bg-[radial-gradient(circle_at_50%_40%,rgba(45,212,191,0.2),rgba(10,24,40,0.75)_70%)] ring-1 ring-cyan-200/40'
            : 'opacity-0'
        )}
      />
      <img
        src={finViseLogoImage}
        alt=""
        aria-hidden="true"
        className={cn(
          'relative z-10 h-full w-full object-contain p-[6%]',
          effectiveTheme === 'dark'
            ? 'brightness-110 drop-shadow-[0_10px_22px_rgba(8,17,31,0.34)]'
            : 'brightness-100 drop-shadow-none'
        )}
        loading="eager"
        decoding="async"
      />
    </span>
  );
}

export function FinViseLogo({
  className,
  iconClassName,
  textClassName,
  subtitleClassName,
  showSubtitle = true,
}: FinViseLogoProps) {
  return (
    <div className={cn('flex items-center gap-4', className)}>
      <div
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-[18px] border border-white/10 bg-white/5 text-cyan-300 shadow-[0_12px_30px_rgba(0,0,0,0.18)]',
          iconClassName
        )}
      >
        <FinViseMark className="h-9 w-9" />
      </div>
      <div className="min-w-0">
        <p className={cn('text-[32px] font-semibold tracking-tight text-white', textClassName)}>FinVise</p>
        {showSubtitle && (
          <p className={cn('text-sm text-slate-300', subtitleClassName)}>Inteligência financeira simplificada</p>
        )}
      </div>
    </div>
  );
}