import { motion, useReducedMotion } from 'framer-motion';
import { Check, LockKeyhole, ShieldCheck, Sparkles, TrendingUp, WalletCards } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from './useTheme';
import { useMediaQuery } from './useMediaQuery';

type ExperienceMode = 'login' | 'register' | 'recovery';

interface AuthExperiencePanelProps {
  mode?: ExperienceMode;
}

interface ExperienceProps {
  isDark: boolean;
  reduceMotion: boolean;
}

function LoginExperience({ isDark, reduceMotion }: ExperienceProps) {
  return (
    <>
      <div className="relative z-10 max-w-2xl">
        <h2 id="auth-experience-login" className={cn('max-w-[15ch] text-4xl font-semibold leading-[1.04] tracking-[-0.04em] xl:text-5xl', isDark ? 'text-slate-50' : 'text-slate-950')}>
          Seu dinheiro, finalmente em perspectiva.
        </h2>
        <p className={cn('mt-4 max-w-lg text-base leading-relaxed xl:text-lg', isDark ? 'text-slate-300' : 'text-slate-600')}>
          Transforme movimentos financeiros em decisões claras, no seu ritmo.
        </p>
      </div>

      <div className="relative z-10 mt-4 hidden h-[21rem] w-full max-w-[44rem] lg:block xl:h-[23rem]" aria-hidden="true">
        <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 700 370" fill="none">
          <defs>
            <linearGradient id="login-flow-primary" x1="20" y1="300" x2="680" y2="65" gradientUnits="userSpaceOnUse">
              <stop stopColor="#22d3ee" stopOpacity="0.04" />
              <stop offset="0.5" stopColor="#2dd4bf" />
              <stop offset="1" stopColor="#2563eb" stopOpacity="0.22" />
            </linearGradient>
          </defs>
          <motion.path
            d="M14 307C92 310 126 232 194 237C268 242 275 312 351 274C426 236 432 117 527 126C601 133 624 79 685 68"
            stroke="url(#login-flow-primary)"
            strokeWidth="5"
            strokeLinecap="round"
            initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
            animate={reduceMotion ? { pathLength: 1, opacity: 1 } : { pathLength: [0.18, 1, 0.18], opacity: [0.35, 1, 0.35] }}
            transition={reduceMotion ? { duration: 0 } : { duration: 7.5, repeat: Infinity, ease: 'easeInOut' }}
          />
          <path d="M18 342C110 321 139 282 209 287C279 292 304 330 374 299C449 266 475 214 548 215C610 217 642 184 687 174" stroke={isDark ? 'rgba(56,189,248,0.35)' : 'rgba(2,132,199,0.22)'} strokeWidth="2.5" strokeLinecap="round" />
        </svg>

        <motion.div
          className={cn('absolute left-[43%] top-[38%] flex h-40 w-40 items-center justify-center rounded-full border backdrop-blur-2xl xl:h-44 xl:w-44', isDark ? 'border-cyan-200/20 bg-slate-950/35 shadow-[0_0_90px_rgba(45,212,191,0.18)]' : 'border-white/90 bg-white/58 shadow-[0_28px_90px_rgba(14,116,144,0.18)]')}
          animate={reduceMotion ? undefined : { y: [0, -9, 0], scale: [1, 1.025, 1] }}
          transition={reduceMotion ? undefined : { duration: 5.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className={cn('absolute inset-3 rounded-full border border-dashed', isDark ? 'border-cyan-200/25' : 'border-cyan-700/20')} />
          <motion.div className="absolute inset-[-19px] rounded-full border border-cyan-300/15" animate={reduceMotion ? undefined : { rotate: 360 }} transition={reduceMotion ? undefined : { duration: 18, repeat: Infinity, ease: 'linear' }}>
            <span className="absolute left-1/2 top-[-5px] h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.9)]" />
          </motion.div>
          <div className="text-center">
            <WalletCards className={cn('mx-auto h-7 w-7', isDark ? 'text-cyan-200' : 'text-cyan-700')} />
            <p className={cn('mt-2 text-xs font-bold uppercase tracking-[0.14em]', isDark ? 'text-slate-300' : 'text-slate-500')}>Visão integrada</p>
            <p className={cn('mt-0.5 text-xl font-bold', isDark ? 'text-white' : 'text-slate-950')}>FinVise AI</p>
          </div>
        </motion.div>

        <motion.div className={cn('absolute left-[3%] top-[43%] rounded-full border px-4 py-3 backdrop-blur-xl', isDark ? 'border-white/10 bg-slate-950/35 text-slate-100' : 'border-white/90 bg-white/70 text-slate-800 shadow-lg')} animate={reduceMotion ? undefined : { y: [0, -10, 0] }} transition={reduceMotion ? undefined : { duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}>
          <span className="flex items-center gap-2 text-sm font-semibold"><TrendingUp className="h-4 w-4 text-emerald-500" /> Projeção +12,8%</span>
        </motion.div>
        <motion.div className={cn('absolute bottom-[2%] right-[1%] rounded-full border px-4 py-3 backdrop-blur-xl', isDark ? 'border-white/10 bg-slate-950/35 text-slate-100' : 'border-white/90 bg-white/70 text-slate-800 shadow-lg')} animate={reduceMotion ? undefined : { y: [0, 9, 0] }} transition={reduceMotion ? undefined : { duration: 5.1, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}>
          <span className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-cyan-500" /> Dados protegidos</span>
        </motion.div>
      </div>

      <div className={cn('relative z-10 hidden flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium lg:flex', isDark ? 'text-slate-400' : 'text-slate-500')}>
        <span>Insights em tempo real</span>
        <span className="h-1 w-1 rounded-full bg-cyan-400" />
        <span>Privacidade por padrão</span>
        <span className="h-1 w-1 rounded-full bg-teal-400" />
        <span>Decisões mais simples</span>
      </div>
    </>
  );
}

function RegisterExperience({ isDark, reduceMotion }: ExperienceProps) {
  const journey = [
    ['01', 'Organize', 'Reúna sua vida financeira em um só lugar.'],
    ['02', 'Entenda', 'Veja padrões e oportunidades com clareza.'],
    ['03', 'Evolua', 'Transforme insights em progresso real.'],
  ] as const;

  return (
    <>
      <div className="relative z-10 max-w-xl">
        <h2 id="auth-experience-register" className={cn('max-w-[15ch] text-[2rem] font-semibold leading-[1.08] tracking-[-0.045em] sm:text-[2.5rem] xl:text-[2.75rem]', isDark ? 'text-white' : 'text-slate-950')}>
          Seu próximo capítulo financeiro começa agora.
        </h2>
        <p className={cn('mt-3 max-w-md text-sm leading-relaxed sm:mt-4 sm:text-base', isDark ? 'text-slate-400' : 'text-slate-600')}>
          A FinVise cresce com você — da primeira organização aos planos mais ambiciosos.
        </p>
      </div>

      <ol className={cn('relative z-10 mt-5 grid grid-cols-3 lg:mt-8 lg:max-w-xl lg:grid-cols-1', isDark ? 'divide-white/10' : 'divide-slate-300/70', 'lg:divide-y')} aria-label="Sua jornada na FinVise">
        {journey.map(([number, title, description], index) => (
          <motion.li
            key={title}
            className="relative flex flex-col items-center px-2 py-2.5 text-center lg:flex-row lg:items-start lg:gap-4 lg:px-0 lg:py-4 lg:text-left"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.35, delay: reduceMotion ? 0 : 0.08 * index }}
          >
            <span className={cn('shrink-0 text-[11px] font-bold tabular-nums tracking-[0.08em] lg:w-7 lg:pt-0.5 lg:text-xs', isDark ? 'text-cyan-300/80' : 'text-cyan-700')}>{number}</span>
            <span className="min-w-0">
              <span className={cn('mt-1 block text-xs font-semibold lg:mt-0 lg:text-[15px]', isDark ? 'text-slate-100' : 'text-slate-900')}>{title}</span>
              <span className={cn('mt-1 hidden text-sm leading-relaxed lg:block', isDark ? 'text-slate-400' : 'text-slate-600')}>{description}</span>
            </span>
          </motion.li>
        ))}
      </ol>

      <div className={cn('relative z-10 mt-5 hidden items-center gap-2 text-xs font-medium lg:flex', isDark ? 'text-emerald-200/80' : 'text-emerald-800')}>
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        Comece grátis e evolua no seu ritmo
      </div>
    </>
  );
}

function RecoveryExperience({ isDark, reduceMotion }: ExperienceProps) {
  return (
    <>
      <div className="relative z-10 lg:max-w-sm">
        <motion.div className={cn('mb-4 flex h-16 w-16 items-center justify-center rounded-full border backdrop-blur-2xl lg:mb-6 lg:h-24 lg:w-24', isDark ? 'border-cyan-200/20 bg-cyan-300/8 text-cyan-200 shadow-[0_0_70px_rgba(34,211,238,0.18)]' : 'border-white bg-white/65 text-cyan-700 shadow-[0_24px_70px_rgba(14,116,144,0.16)]')} animate={reduceMotion ? undefined : { scale: [1, 1.05, 1] }} transition={reduceMotion ? undefined : { duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
          <LockKeyhole className="h-7 w-7 lg:h-10 lg:w-10" aria-hidden="true" />
        </motion.div>
        <h2 id="auth-experience-recovery" className={cn('max-w-[18ch] text-2xl font-semibold leading-[1.05] tracking-[-0.045em] sm:text-4xl lg:max-w-[14ch]', isDark ? 'text-white' : 'text-slate-950')}>
          Seu acesso volta. Sua segurança permanece.
        </h2>
        <p className={cn('mt-2 text-sm leading-relaxed sm:mt-4 sm:text-base', isDark ? 'text-slate-300' : 'text-slate-600')}>
          Cada etapa confirma que é você, sem expor seus dados ou complicar o processo.
        </p>
      </div>
      <ul className="relative z-10 mt-6 hidden space-y-3 lg:block" aria-label="Proteções da recuperação de senha">
        {['Código temporário de uso único', 'Nova senha protegida', 'Processo rápido e transparente'].map((label) => (
          <li key={label} className={cn('flex items-center gap-3 text-sm font-semibold', isDark ? 'text-slate-300' : 'text-slate-700')}>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600"><Check className="h-4 w-4" /></span>
            {label}
          </li>
        ))}
      </ul>
    </>
  );
}

export function AuthExperiencePanel({ mode = 'login' }: AuthExperiencePanelProps) {
  const { resolvedTheme } = useTheme();
  const desktopMotionEnabled = useMediaQuery('(min-width: 1280px)');
  const reduceMotion = Boolean(useReducedMotion()) || !desktopMotionEnabled;
  const isDark = resolvedTheme === 'dark';

  return (
    <section
      data-testid="finance-motion-card"
      aria-labelledby={`auth-experience-${mode}`}
      className={cn(
        'relative isolate flex h-full w-full flex-col justify-center overflow-hidden px-2 py-5 sm:px-4 lg:min-h-[34rem] lg:px-6 lg:py-8 xl:px-9',
        mode === 'recovery' && 'lg:min-h-0 lg:px-4 lg:py-8'
      )}
    >
      <div aria-hidden="true" className={cn('absolute left-[8%] top-[16%] h-64 w-64 rounded-full blur-3xl', isDark ? 'bg-cyan-400/10' : 'bg-cyan-300/22')} />
      <div aria-hidden="true" className={cn('absolute bottom-[8%] right-[4%] h-72 w-72 rounded-full blur-3xl', isDark ? 'bg-teal-400/8' : 'bg-blue-300/16')} />
      {mode === 'login' ? <LoginExperience isDark={isDark} reduceMotion={reduceMotion} /> : null}
      {mode === 'register' ? <RegisterExperience isDark={isDark} reduceMotion={reduceMotion} /> : null}
      {mode === 'recovery' ? <RecoveryExperience isDark={isDark} reduceMotion={reduceMotion} /> : null}
    </section>
  );
}
