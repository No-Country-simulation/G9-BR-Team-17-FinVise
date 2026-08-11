import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/auth/useTheme';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-[14px] text-sm font-semibold tracking-tight transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transform-none motion-reduce:transition-none',
  {
    variants: {
      variant: {
        default:
          'app-primary-button relative overflow-hidden rounded-full border border-cyan-200/20 bg-[#078da2] text-white shadow-[0_10px_32px_-16px_rgba(0,188,214,0.55)] before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:bg-white/15 before:opacity-0 before:scale-75 before:transition-all before:duration-500 hover:-translate-y-0.5 hover:bg-[#079aae] hover:shadow-[0_14px_38px_-14px_rgba(0,188,214,0.48)] hover:before:scale-100 hover:before:opacity-100 active:translate-y-0 active:scale-[0.98] focus-visible:-translate-y-0.5 focus-visible:shadow-[0_14px_38px_-14px_rgba(0,188,214,0.48)] motion-reduce:before:transition-none',
        destructive:
          'bg-[linear-gradient(180deg,#dc2626_0%,#b91c1c_100%)] text-white shadow-[0_12px_30px_rgba(185,28,28,0.22)] hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(185,28,28,0.28)] focus-visible:-translate-y-0.5 focus-visible:shadow-[0_16px_38px_rgba(185,28,28,0.28)]',
        outline:
          'border border-white/12 bg-white/6 text-slate-100 hover:-translate-y-0.5 hover:bg-white/10 focus-visible:-translate-y-0.5 focus-visible:bg-white/10',
        secondary:
          'border border-white/10 bg-white/8 text-slate-100 hover:-translate-y-0.5 hover:bg-white/12 focus-visible:-translate-y-0.5 focus-visible:bg-white/12',
        ghost: 'text-slate-300 hover:bg-white/8 hover:text-white',
        link: 'text-primary-600 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-5 py-2 text-sm',
        sm: 'h-10 px-4 text-xs',
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
      {...props}
      disabled={isLoading || props.disabled}
      aria-busy={isLoading || undefined}
    >
      {isLoading && (
        <svg
          className="mr-2 h-4 w-4 animate-spin"
          aria-hidden="true"
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
