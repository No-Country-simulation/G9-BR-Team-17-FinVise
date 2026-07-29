import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LoadingSpinner } from './LoadingSpinner';

const authButtonVariants = cva(
  'inline-flex h-14 w-full items-center justify-center rounded-[14px] px-5 text-[16px] font-semibold tracking-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:pointer-events-none disabled:opacity-60',
  {
    variants: {
      variant: {
        primary:
          'bg-[linear-gradient(180deg,#5fe6ea_0%,#2fcbd7_100%)] text-slate-950 shadow-[0_12px_30px_rgba(45,212,191,0.20)] hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(45,212,191,0.24)]',
        secondary:
          'border border-white/10 bg-white/5 text-slate-100 hover:-translate-y-0.5 hover:bg-white/8',
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
  return (
    <button className={cn(authButtonVariants({ variant: 'primary' }), className)} disabled={disabled || isLoading} {...props}>
      {isLoading ? <LoadingSpinner size="sm" className="mr-2" /> : leadingIcon ? <span className="mr-2 inline-flex">{leadingIcon}</span> : null}
      {children}
    </button>
  );
}

export function SecondaryButton({ className, isLoading, leadingIcon, children, disabled, ...props }: ButtonProps) {
  return (
    <button className={cn(authButtonVariants({ variant: 'secondary' }), className)} disabled={disabled || isLoading} {...props}>
      {isLoading ? <LoadingSpinner size="sm" className="mr-2" /> : leadingIcon ? <span className="mr-2 inline-flex">{leadingIcon}</span> : null}
      {children}
    </button>
  );
}