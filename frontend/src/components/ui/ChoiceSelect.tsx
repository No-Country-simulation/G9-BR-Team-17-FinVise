import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, type LucideIcon } from 'lucide-react';
import { useTheme } from '@/components/auth/useTheme';
import { cn } from '@/lib/utils';

export interface ChoiceSelectOption {
  value: string;
  label: string;
  description?: string;
  badge?: string;
  icon?: LucideIcon;
}

interface ChoiceSelectProps {
  value: string;
  options: ChoiceSelectOption[];
  onChange: (value: string) => void;
  label: string;
  className?: string;
  disabled?: boolean;
}

export function ChoiceSelect({
  value,
  options,
  onChange,
  label,
  className,
  disabled = false,
}: ChoiceSelectProps) {
  const { resolvedTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const labelId = useId();
  const selectedOption = options[selectedIndex];
  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  const optionIds = useMemo(
    () => options.map((_, index) => `${listboxId}-option-${index}`),
    [listboxId, options],
  );

  const openMenu = (index = selectedIndex) => {
    if (disabled || options.length === 0) return;
    setActiveIndex(index);
    setIsOpen(true);
  };

  const chooseOption = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setActiveIndex(index);
    setIsOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || options.length === 0) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) {
        openMenu(event.key === 'ArrowDown' ? selectedIndex : options.length - 1);
        return;
      }
      setActiveIndex((current) => (
        event.key === 'ArrowDown'
          ? (current + 1) % options.length
          : (current - 1 + options.length) % options.length
      ));
      return;
    }

    if (event.key === 'Home' && isOpen) {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }

    if (event.key === 'End' && isOpen) {
      event.preventDefault();
      setActiveIndex(options.length - 1);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (isOpen) chooseOption(activeIndex);
      else openMenu();
      return;
    }

    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      setIsOpen(false);
      return;
    }

    if (event.key === 'Tab') setIsOpen(false);
  };

  const SelectedIcon = selectedOption?.icon;

  return (
    <div ref={rootRef} className={cn('relative min-w-0', className)}>
      <span
        id={labelId}
        className={cn(
          'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em]',
          isDark ? 'text-slate-300' : 'text-slate-500',
        )}
      >
        {label}
      </span>

      <button
        type="button"
        role="combobox"
        value={value}
        aria-labelledby={labelId}
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-activedescendant={isOpen ? optionIds[activeIndex] : undefined}
        disabled={disabled || options.length === 0}
        onClick={() => (isOpen ? setIsOpen(false) : openMenu())}
        onKeyDown={handleKeyDown}
        className={cn(
          'group flex h-12 w-full items-center gap-3 rounded-2xl border px-3 text-left shadow-[0_8px_24px_-20px_rgba(15,23,42,0.5)] backdrop-blur-xl transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/70 disabled:cursor-not-allowed disabled:opacity-50',
          isDark
            ? 'border-white/10 bg-white/[0.045] text-slate-100 hover:border-cyan-300/25 hover:bg-white/[0.07]'
            : 'border-slate-200/80 bg-white/70 text-slate-900 hover:border-cyan-700/25 hover:bg-white/90',
          isOpen && (isDark ? 'border-cyan-300/35 bg-white/[0.08]' : 'border-cyan-700/35 bg-white/95'),
        )}
      >
        {SelectedIcon && (
          <span className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
            isDark ? 'bg-cyan-300/10 text-cyan-200' : 'bg-cyan-700/[0.08] text-cyan-800',
          )}>
            <SelectedIcon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {selectedOption?.label ?? 'Selecione uma opção'}
        </span>
        {selectedOption?.badge && (
          <span className={cn(
            'hidden rounded-full px-2 py-0.5 text-[10px] font-semibold sm:inline-flex',
            isDark ? 'bg-white/[0.07] text-slate-300' : 'bg-slate-100/90 text-slate-500',
          )}>
            {selectedOption.badge}
          </span>
        )}
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 transition-transform duration-200', isOpen && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-labelledby={labelId}
          className={cn(
            'absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-2xl border p-1.5 shadow-[0_22px_50px_-24px_rgba(15,23,42,0.65)] backdrop-blur-2xl',
            isDark ? 'border-white/10 bg-slate-950/95' : 'border-slate-200/80 bg-white/95',
          )}
        >
          {options.map((option, index) => {
            const Icon = option.icon;
            const selected = option.value === value;
            const active = index === activeIndex;

            return (
              <button
                key={option.value}
                id={optionIds[index]}
                type="button"
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => chooseOption(index)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                  isDark
                    ? 'text-slate-200 hover:bg-white/[0.07]'
                    : 'text-slate-700 hover:bg-slate-100/80',
                  active && (isDark ? 'bg-white/[0.07]' : 'bg-slate-100/80'),
                )}
              >
                {Icon && (
                  <span className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
                    selected
                      ? 'bg-[#078da2] text-white'
                      : isDark ? 'bg-white/[0.05] text-slate-400' : 'bg-slate-100 text-slate-500',
                  )}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-sm', selected ? 'font-semibold' : 'font-medium')}>
                    {option.label}
                  </span>
                  {option.description && (
                    <span className={cn('mt-0.5 block truncate text-xs', isDark ? 'text-slate-400' : 'text-slate-500')}>
                      {option.description}
                    </span>
                  )}
                </span>
                {option.badge && (
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                    isDark ? 'bg-white/[0.07] text-slate-300' : 'bg-slate-100 text-slate-500',
                  )}>
                    {option.badge}
                  </span>
                )}
                {selected && (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#078da2] text-white">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
