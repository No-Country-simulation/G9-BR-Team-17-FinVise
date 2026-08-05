import { cn } from '@/lib/utils';
import { useTheme } from '@/components/auth/useTheme';

type DivProps = React.ComponentPropsWithRef<'div'>;
type HeadingProps = React.ComponentPropsWithRef<'h3'>;
type ParagraphProps = React.ComponentPropsWithRef<'p'>;

function Card({ className, ref, ...props }: DivProps) {
  const { resolvedTheme } = useTheme();

  return (
    <div
      ref={ref}
      className={cn(
        'rounded-[28px] border backdrop-blur-[28px] transition-colors',
        resolvedTheme === 'dark'
          ? 'border-white/10 bg-[rgba(8,15,28,0.72)] text-white shadow-[0_22px_70px_rgba(2,8,23,0.26)]'
          : 'border-slate-200/80 bg-[rgba(255,255,255,0.82)] text-slate-900 shadow-[0_22px_70px_rgba(15,23,42,0.10)]',
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ref, ...props }: DivProps) {
  return <div ref={ref} className={cn('flex flex-col space-y-1.5 p-5 sm:p-6', className)} {...props} />;
}

function CardTitle({ className, ref, ...props }: HeadingProps) {
  return (
    <h3
      ref={ref}
      className={cn('text-lg font-semibold leading-none tracking-tight sm:text-xl', className)}
      {...props}
    />
  );
}

function CardDescription({ className, ref, ...props }: ParagraphProps) {
  return <p ref={ref} className={cn('text-sm leading-6 text-slate-500', className)} {...props} />;
}

function CardContent({ className, ref, ...props }: DivProps) {
  return <div ref={ref} className={cn('p-5 pt-0 sm:p-6 sm:pt-0', className)} {...props} />;
}

function CardFooter({ className, ref, ...props }: DivProps) {
  return <div ref={ref} className={cn('flex items-center p-5 pt-0 sm:p-6 sm:pt-0', className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
