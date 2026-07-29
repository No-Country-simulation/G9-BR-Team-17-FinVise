import { cn } from '@/lib/utils';

interface DividerProps {
  label?: string;
  className?: string;
}

export function Divider({ label, className }: DividerProps) {
  return (
    <div className={cn('flex items-center gap-4', className)}>
      <div className="h-px flex-1 bg-white/10" />
      {label && <span className="text-xs uppercase tracking-[0.22em] text-slate-400">{label}</span>}
      <div className="h-px flex-1 bg-white/10" />
    </div>
  );
}