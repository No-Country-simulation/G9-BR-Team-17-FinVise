import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from './ThemeProvider';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
}

export function GlassCard({ children, className }: GlassCardProps) {
  const { resolvedTheme } = useTheme();

  return (
    <div
      className={cn(
        'rounded-[28px] border p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-[28px] sm:p-8 md:p-10',
        resolvedTheme === 'dark'
          ? 'border-white/10 bg-[rgba(28,39,58,0.65)] text-white'
          : 'border-slate-200/80 bg-[rgba(255,255,255,0.78)] text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.12)]',
        className
      )}
    >
      {children}
    </div>
  );
}