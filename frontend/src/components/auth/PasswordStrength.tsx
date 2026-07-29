import { CheckCircle2, Circle } from 'lucide-react';
import { motion } from 'framer-motion';

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
  if (allPassed) return 'bg-emerald-400';
  if (score <= 0) return 'bg-red-400';
  if (score === 1) return 'bg-orange-400';
  if (score === 2) return 'bg-amber-400';
  return 'bg-cyan-400';
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const checks = rules.map((rule) => ({ label: rule.label, passed: rule.test(password) }));
  const passedCount = checks.filter((item) => item.passed).length;
  const score = getScore(password);
  const allPassed = passedCount === rules.length;
  const progress = password.length === 0 ? 0 : (passedCount / rules.length) * 100;
  const scoreLabel = password.length === 0 ? 'Muito fraca' : scoreLabels[score];

  return (
    <div className="space-y-2.5 rounded-2xl border border-white/10 bg-white/5 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-200">Força da senha</p>
        <p className={`text-sm font-semibold ${allPassed ? 'text-emerald-300' : 'text-slate-300'}`}>
          {scoreLabel}
        </p>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className={`h-full rounded-full ${getBarClass(score, allPassed)}`}
          animate={{ width: `${progress}%` }}
          transition={{ type: 'spring', stiffness: 180, damping: 24 }}
        />
      </div>

      <div className="grid gap-1.5 sm:grid-cols-2">
        {checks.map((item) => (
          <p key={item.label} className="flex items-center gap-1.5 text-sm text-slate-300">
            {item.passed ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-300" aria-hidden="true" />
            ) : (
              <Circle className="h-4 w-4 text-slate-500" aria-hidden="true" />
            )}
            <span>{item.label}</span>
          </p>
        ))}
      </div>
    </div>
  );
}