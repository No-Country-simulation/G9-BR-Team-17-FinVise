import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div
      className={cn(
        'relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-6 sm:px-8 md:px-10 md:py-8 lg:px-12',
        className
      )}
    >
      {children}
    </div>
  );
}