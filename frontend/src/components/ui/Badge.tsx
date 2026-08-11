import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/auth/useTheme';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary-100 text-primary-800',
        success: 'border-transparent bg-emerald-100 text-emerald-800',
        warning: 'border-transparent bg-amber-100 text-amber-800',
        danger: 'border-transparent bg-red-100 text-red-800',
        outline: 'border-slate-300 text-slate-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  const { resolvedTheme } = useTheme();
  const selectedVariant = variant ?? 'default';
  const darkVariantClasses = {
    default: 'border-cyan-300/15 bg-cyan-400/15 text-cyan-200',
    success: 'border-emerald-300/15 bg-emerald-400/15 text-emerald-200',
    warning: 'border-amber-300/15 bg-amber-400/15 text-amber-200',
    danger: 'border-red-300/15 bg-red-400/15 text-red-200',
    outline: 'border-white/15 bg-white/5 text-slate-200',
  };

  return (
    <div
      className={cn(
        badgeVariants({ variant }),
        resolvedTheme === 'dark' && darkVariantClasses[selectedVariant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
