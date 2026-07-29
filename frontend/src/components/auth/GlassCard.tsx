import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
}

export function GlassCard({ children, className }: GlassCardProps) {
  return (
    <div
      className={cn(
        'rounded-[28px] border border-white/10 bg-[rgba(28,39,58,0.65)] p-5 text-white shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-[28px] sm:p-8 md:p-10',
        className
      )}
    >
      {children}
    </div>
  );
}