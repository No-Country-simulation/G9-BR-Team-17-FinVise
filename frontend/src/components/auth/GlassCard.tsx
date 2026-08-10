import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from './useTheme';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
}

export function GlassCard({ children, className, ...props }: GlassCardProps & React.HTMLAttributes<HTMLDivElement>) {
  const { resolvedTheme } = useTheme();

  return (
    <div
      {...props}
      className={cn(
        'auth-glass-card relative isolate overflow-hidden rounded-[24px] border p-5 backdrop-blur-[24px] backdrop-saturate-[145%] transform-gpu sm:p-7 md:p-8',
        resolvedTheme === 'dark'
          ? 'border-white/15 bg-[linear-gradient(145deg,rgba(15,29,47,0.58)_0%,rgba(5,16,30,0.46)_54%,rgba(8,24,39,0.52)_100%)] text-white shadow-[0_32px_90px_rgba(2,8,23,0.34),0_8px_28px_rgba(2,8,23,0.2),inset_0_1px_0_rgba(255,255,255,0.14),inset_0_-1px_0_rgba(255,255,255,0.04)]'
          : 'border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.68)_0%,rgba(245,250,252,0.48)_56%,rgba(255,255,255,0.58)_100%)] text-slate-950 shadow-[0_32px_90px_rgba(15,23,42,0.12),0_8px_26px_rgba(14,116,144,0.07),inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(255,255,255,0.5)]',
        className
      )}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
}
