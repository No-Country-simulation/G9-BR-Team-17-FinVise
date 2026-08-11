import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LoadingSpinner } from './LoadingSpinner';
import { useTheme } from './useTheme';

const authButtonVariants = cva(
  'inline-flex h-12 w-full items-center justify-center rounded-full px-6 text-[15px] font-semibold tracking-[0.005em] transition-all duration-300 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:translate-y-0 disabled:scale-100 motion-reduce:transform-none motion-reduce:transition-none',
  {
    variants: {
      variant: {
        primary:
          'auth-primary-button relative overflow-hidden border border-cyan-200/20 bg-[#078da2] text-white shadow-[0_10px_32px_-16px_rgba(0,188,214,0.55)] before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:bg-white/15 before:opacity-0 before:scale-75 before:transition-all before:duration-500 hover:-translate-y-0.5 hover:bg-[#079aae] hover:shadow-[0_14px_38px_-14px_rgba(0,188,214,0.48)] hover:before:scale-100 hover:before:opacity-100 focus-visible:-translate-y-0.5 focus-visible:shadow-[0_14px_38px_-14px_rgba(0,188,214,0.48)] disabled:bg-[#176f7d] disabled:shadow-none disabled:before:hidden motion-reduce:before:transition-none',
        secondary:
          'border border-white/15 bg-white/7 text-white shadow-sm hover:-translate-y-0.5 hover:bg-white/12 disabled:opacity-50',
      },
    },
    defaultVariants: {
      variant: 'primary',
    },
  }
);

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof authButtonVariants> {
  isLoading?: boolean;
  leadingIcon?: ReactNode;
}

export function PrimaryButton({ className, isLoading, leadingIcon, children, disabled, ...props }: ButtonProps) {
  const { resolvedTheme } = useTheme();

  return (
    <button
      className={cn(authButtonVariants({ variant: 'primary' }), resolvedTheme === 'dark' ? 'focus-visible:ring-offset-slate-950' : 'focus-visible:ring-offset-white', className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? <LoadingSpinner size="sm" className="mr-2" /> : leadingIcon ? <span className="auth-primary-label mr-2 inline-flex">{leadingIcon}</span> : null}
      <span className="auth-primary-label inline-flex items-center justify-center">{children}</span>
    </button>
  );
}

export function SecondaryButton({ className, isLoading, leadingIcon, children, disabled, ...props }: ButtonProps) {
  const { resolvedTheme } = useTheme();

  return (
    <button
      className={cn(
        authButtonVariants({ variant: 'secondary' }),
        resolvedTheme === 'dark'
          ? 'focus-visible:ring-offset-slate-950'
          : 'border-slate-200 bg-white/75 text-slate-800 hover:bg-white focus-visible:ring-offset-white',
        className
      )}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? <LoadingSpinner size="sm" className="mr-2" /> : leadingIcon ? <span className="mr-2 inline-flex">{leadingIcon}</span> : null}
      {children}
    </button>
  );
}
