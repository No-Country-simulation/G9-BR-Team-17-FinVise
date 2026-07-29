import type { SVGProps } from 'react';
import { cn } from '@/lib/utils';

interface FinViseLogoProps {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  subtitleClassName?: string;
  showSubtitle?: boolean;
}

function FinViseMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 72 72" fill="none" aria-hidden="true" {...props}>
      <rect x="10" y="12" width="10" height="48" rx="4" fill="currentColor" />
      <rect x="24" y="22" width="10" height="38" rx="4" fill="currentColor" opacity="0.9" />
      <rect x="38" y="34" width="10" height="26" rx="4" fill="currentColor" opacity="0.8" />
      <path d="M52 24L62 24L62 34" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 18L52 18" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.12" />
    </svg>
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