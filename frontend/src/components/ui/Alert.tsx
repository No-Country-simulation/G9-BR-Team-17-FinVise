import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/auth/useTheme';

const alertVariants = cva(
  'relative w-full rounded-[24px] border p-4 backdrop-blur-xl [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:h-5 [&>svg]:w-5 [&>svg+div]:translate-y-[-3px] [&:has(svg)]:pl-11',
  {
    variants: {
      variant: {
        default: 'bg-[rgba(255,255,255,0.72)] text-slate-900 border-slate-200/80',
        info: 'bg-[rgba(207,250,254,0.72)] text-cyan-950 border-cyan-200/70 [&>svg]:text-cyan-600',
        success: 'bg-[rgba(209,250,229,0.72)] text-emerald-950 border-emerald-200/70 [&>svg]:text-emerald-500',
        warning: 'bg-[rgba(254,243,199,0.72)] text-amber-950 border-amber-200/70 [&>svg]:text-amber-500',
        danger: 'bg-[rgba(254,226,226,0.72)] text-red-950 border-red-200/70 [&>svg]:text-red-500',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

function Alert({ className, variant, ...props }: AlertProps) {
  const { resolvedTheme } = useTheme();
  const selectedVariant = variant ?? 'default';
  const darkVariantClasses = {
    default: 'border-white/10 bg-[rgba(8,15,28,0.82)] text-slate-100',
    info: 'border-cyan-300/20 bg-[rgba(8,84,99,0.38)] text-cyan-100 [&>svg]:text-cyan-300',
    success: 'border-emerald-300/20 bg-[rgba(6,78,59,0.38)] text-emerald-100 [&>svg]:text-emerald-300',
    warning: 'border-amber-300/20 bg-[rgba(120,53,15,0.38)] text-amber-100 [&>svg]:text-amber-300',
    danger: 'border-red-300/20 bg-[rgba(127,29,29,0.38)] text-red-100 [&>svg]:text-red-300',
  };

  return (
    <div
      role="alert"
      className={cn(
        alertVariants({ variant }),
        resolvedTheme === 'dark' && darkVariantClasses[selectedVariant],
        resolvedTheme === 'dark' && 'shadow-[0_20px_60px_rgba(2,8,23,0.18)]',
        className
      )}
      {...props}
    />
  );
}

const AlertTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h5 className={cn('mb-1 font-medium leading-none tracking-tight', className)} {...props} />
);
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('text-sm', className)} {...props} />
);
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription };
