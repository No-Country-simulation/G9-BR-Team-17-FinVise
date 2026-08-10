import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function PageContainer({ children, className, ...props }: PageContainerProps) {
  return (
    <div
      className={cn(
        'relative flex min-h-dvh items-center justify-center overflow-x-hidden px-3 py-5 sm:px-6 sm:py-6 md:px-10 md:py-8 lg:px-12',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
