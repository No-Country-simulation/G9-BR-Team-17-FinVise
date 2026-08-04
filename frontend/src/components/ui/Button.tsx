import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/auth/ThemeProvider';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-[14px] text-sm font-semibold tracking-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-[linear-gradient(180deg,#5fe6ea_0%,#2fcbd7_100%)] text-slate-950 shadow-[0_12px_30px_rgba(45,212,191,0.20)] hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(45,212,191,0.24)]',
        destructive:
          'bg-[linear-gradient(180deg,#fb7185_0%,#ef4444_100%)] text-white shadow-[0_12px_30px_rgba(239,68,68,0.20)] hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(239,68,68,0.26)]',
        outline:
          'border border-white/12 bg-white/6 text-slate-100 hover:-translate-y-0.5 hover:bg-white/10',
        secondary:
          'border border-white/10 bg-white/8 text-slate-100 hover:-translate-y-0.5 hover:bg-white/12',
        ghost: 'text-slate-300 hover:bg-white/8 hover:text-white',
        link: 'text-primary-600 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-14 px-5 py-2 text-[16px]',
        sm: 'h-10 px-3 text-xs sm:h-10',
        lg: 'h-12 px-6 text-base',
        icon: 'h-11 w-11 rounded-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ComponentPropsWithRef<'button'>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

function Button({ className, variant, size, isLoading, children, ref, ...props }: ButtonProps) {
  const { resolvedTheme } = useTheme();

  return (
    <button
      ref={ref}
      className={cn(
        buttonVariants({ variant, size }),
        resolvedTheme === 'light' && variant === 'outline' && 'border-slate-300 bg-white/80 text-slate-700 hover:bg-slate-50',
        resolvedTheme === 'light' && variant === 'secondary' && 'bg-slate-100 text-slate-900 hover:bg-slate-200',
        resolvedTheme === 'light' && variant === 'ghost' && 'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
        className
      )}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading && (
        <svg
          className="mr-2 h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}

export { Button };
