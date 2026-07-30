import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { retrievalDepthOptions } from '@/components/agent/agentContextOptions';
import { cn } from '@/lib/utils';

interface AgentDepthSelectorProps {
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}

export function AgentDepthSelector({
  value,
  disabled,
  onChange,
}: AgentDepthSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedOption = retrievalDepthOptions.find((option) => option.value === value)
    ?? retrievalDepthOptions[1];

  useEffect(() => {
    if (disabled) setIsOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label="Profundidade da recuperação"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls="agent-depth-options"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        className={cn(
          'flex h-10 min-w-28 items-center justify-between gap-2 rounded-full px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50',
          isOpen && 'bg-slate-200 text-slate-900'
        )}
      >
        <span>{selectedOption.label}</span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 transition-transform', isOpen && 'rotate-180')}
        />
        <span className="sr-only">{selectedOption.description}</span>
      </button>

      {isOpen && (
        <div
          id="agent-depth-options"
          role="listbox"
          aria-label="Opções de profundidade"
          className="absolute bottom-[calc(100%+0.625rem)] right-0 z-30 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10"
        >
          <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Profundidade da busca
          </p>
          <div className="space-y-0.5">
            {retrievalDepthOptions.map((option) => {
              const selected = option.value === value;

              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    triggerRef.current?.focus();
                  }}
                  className={cn(
                    'flex min-h-12 w-full items-center gap-2.5 rounded-xl px-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                    selected ? 'bg-slate-100' : 'hover:bg-slate-50'
                  )}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    {selected && <Check className="h-4 w-4 text-primary-600" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-slate-800">
                      {option.label}
                    </span>
                    <span className="block text-[10px] leading-4 text-slate-500">
                      {option.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
