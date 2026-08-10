import { CheckCircle2, Circle } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useTheme } from './useTheme';

interface PasswordStrengthProps {
  password: string;
}

type Rule = {
  label: string;
  test: (value: string) => boolean;
};

const rules: Rule[] = [
  { label: 'Mínimo de 8 caracteres', test: (value) => value.length >= 8 },
  { label: 'Letra maiúscula', test: (value) => /[A-Z]/.test(value) },
  { label: 'Letra minúscula', test: (value) => /[a-z]/.test(value) },
  { label: 'Número', test: (value) => /\d/.test(value) },
  { label: 'Caractere especial', test: (value) => /[^A-Za-z0-9]/.test(value) },
];

const scoreLabels = ['Muito fraca', 'Fraca', 'Regular', 'Boa', 'Forte'] as const;

function getScore(password: string): number {
  if (!password) return 0;
  const passed = rules.reduce((count, rule) => count + (rule.test(password) ? 1 : 0), 0);
  return Math.min(4, Math.max(0, passed - 1));
}

function getBarClass(score: number, allPassed: boolean): string {
  if (allPassed) return 'bg-emerald-500';
  if (score <= 0) return 'bg-red-500';
  if (score === 1) return 'bg-orange-500';
  if (score === 2) return 'bg-amber-500';
  return 'bg-cyan-500';
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const { resolvedTheme } = useTheme();
  const checks = rules.map((rule) => ({ label: rule.label, passed: rule.test(password) }));
  const passedCount = checks.filter((item) => item.passed).length;
  const score = getScore(password);
  const allPassed = passedCount === rules.length;
  const progress = password.length === 0 ? 0 : (passedCount / rules.length) * 100;
  const scoreLabel = password.length === 0 ? 'Muito fraca' : scoreLabels[score];

  return (
    <div className={cn('space-y-2.5 rounded-2xl border p-3.5', resolvedTheme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50/80')}>
      <div className="flex items-center justify-between gap-2">
        <p className={cn('text-sm font-medium', resolvedTheme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>Força da senha</p>
        <p className={cn('text-sm font-semibold', allPassed ? resolvedTheme === 'dark' ? 'text-emerald-300' : 'text-emerald-700' : resolvedTheme === 'dark' ? 'text-slate-300' : 'text-slate-600')}>
          {scoreLabel}
        </p>
      </div>

      <div className={cn('h-2 overflow-hidden rounded-full', resolvedTheme === 'dark' ? 'bg-white/10' : 'bg-slate-200')}>
        <motion.div
          className={cn('h-full rounded-full', getBarClass(score, allPassed))}
          animate={{ width: `${progress}%` }}
          transition={{ type: 'spring', stiffness: 180, damping: 24 }}
        />
      </div>

      <div className="grid gap-1.5 sm:grid-cols-2">
        {checks.map((item) => (
          <p key={item.label} className={cn('flex items-center gap-1.5 text-sm', resolvedTheme === 'dark' ? 'text-slate-300' : 'text-slate-600')}>
            {item.passed ? (
              <CheckCircle2 className={cn('h-4 w-4', resolvedTheme === 'dark' ? 'text-emerald-300' : 'text-emerald-600')} aria-hidden="true" />
            ) : (
              <Circle className={cn('h-4 w-4', resolvedTheme === 'dark' ? 'text-slate-500' : 'text-slate-400')} aria-hidden="true" />
            )}
            <span>{item.label}</span>
          </p>
        ))}
      </div>
    </div>
  );
}
