import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const alertVariants = cva(
  'relative w-full rounded-lg border p-4 [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:h-5 [&>svg]:w-5 [&>svg+div]:translate-y-[-3px] [&:has(svg)]:pl-11',
  {
    variants: {
      variant: {
        default: 'bg-slate-50 text-slate-900 border-slate-200',
        info: 'bg-blue-50 text-blue-900 border-blue-200 [&>svg]:text-blue-600',
        success: 'bg-emerald-50 text-emerald-900 border-emerald-200 [&>svg]:text-emerald-600',
        warning: 'bg-amber-50 text-amber-900 border-amber-200 [&>svg]:text-amber-600',
        danger: 'bg-red-50 text-red-900 border-red-200 [&>svg]:text-red-600',
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
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
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
