import { cn } from '@/lib/utils';

type DivProps = React.ComponentPropsWithRef<'div'>;
type HeadingProps = React.ComponentPropsWithRef<'h3'>;
type ParagraphProps = React.ComponentPropsWithRef<'p'>;

function Card({ className, ref, ...props }: DivProps) {
  return (
    <div
      ref={ref}
      className={cn('rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm', className)}
      {...props}
    />
  );
}

function CardHeader({ className, ref, ...props }: DivProps) {
  return <div ref={ref} className={cn('flex flex-col space-y-1.5 p-4 sm:p-6', className)} {...props} />;
}

function CardTitle({ className, ref, ...props }: HeadingProps) {
  return (
    <h3
      ref={ref}
      className={cn('text-lg font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  );
}

function CardDescription({ className, ref, ...props }: ParagraphProps) {
  return <p ref={ref} className={cn('text-sm text-slate-500', className)} {...props} />;
}

function CardContent({ className, ref, ...props }: DivProps) {
  return <div ref={ref} className={cn('p-4 pt-0 sm:p-6 sm:pt-0', className)} {...props} />;
}

function CardFooter({ className, ref, ...props }: DivProps) {
  return <div ref={ref} className={cn('flex items-center p-4 pt-0 sm:p-6 sm:pt-0', className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
