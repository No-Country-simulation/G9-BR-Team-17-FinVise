import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LoadingSpinner } from './LoadingSpinner';
import { useTheme } from './useTheme';

const authButtonVariants = cva(
  'inline-flex h-12 w-full items-center justify-center rounded-xl px-5 text-[15px] font-bold tracking-[0.005em] transition-all duration-200 active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:translate-y-0 sm:h-[3.125rem]',
  {
    variants: {
      variant: {
        primary:
          'auth-primary-button bg-[linear-gradient(135deg,#0e7490_0%,#0f766e_100%)] text-white shadow-[0_10px_24px_rgba(15,118,110,0.22)] hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_14px_30px_rgba(15,118,110,0.28)] disabled:bg-[linear-gradient(135deg,#17677a_0%,#176b64_100%)] disabled:shadow-none',
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
