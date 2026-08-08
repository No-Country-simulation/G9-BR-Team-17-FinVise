import { cn } from '@/lib/utils';
import { useTheme } from '@/components/auth/useTheme';

export interface InputProps extends React.ComponentPropsWithRef<'input'> {
  error?: string;
}

function Input({ className, error, ref, ...props }: InputProps) {
  const { resolvedTheme } = useTheme();

  return (
    <div className="w-full">
      <input
        ref={ref}
        className={cn(
            'flex h-11 w-full rounded-[14px] border px-4 py-2 text-base caret-cyan-300 backdrop-blur-xl focus:border-transparent focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm',
            resolvedTheme === 'dark'
              ? 'border-white/12 bg-white/6 text-white placeholder:text-slate-400 focus:ring-cyan-300/40 [color-scheme:dark]'
              : 'border-slate-200/80 bg-white/78 text-slate-900 placeholder:text-slate-400 focus:ring-primary-500 [color-scheme:light]',
          error && 'border-danger focus:ring-danger',
          className
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

export { Input };
