import { cn } from '@/lib/utils';

type SkeletonProps = React.ComponentPropsWithRef<'div'>;

export function Skeleton({ className, ref, ...props }: SkeletonProps) {
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn('skeleton-shimmer rounded-lg', className)}
      {...props}
    />
  );
}

interface SkeletonRegionProps extends React.ComponentPropsWithRef<'div'> {
  label?: string;
}

export function SkeletonRegion({
  className,
  children,
  label = 'Carregando conteúdo',
  ref,
  ...props
}: SkeletonRegionProps) {
  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={className}
      {...props}
    >
      {children}
      <span className="sr-only">{label}</span>
    </div>
  );
}
