import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import {
  AuthLayout,
  AuthLayoutCard,
  AuthInput,
  Checkbox,
  PasswordInput,
  PrimaryButton,
} from '@/components/auth';

import { authService } from '@/services/authService';
import { extractErrorMessage } from '@/lib/api';

const loginSchema = z.object({
  email: z.string().min(1, 'Informe seu e-mail').email('Informe um e-mail válido'),
  password: z.string().min(1, 'Informe sua senha'),
});

type LoginFormData = z.infer<typeof loginSchema>;

function AIFinanceMotionPanel() {
  return (
    <div data-testid="finance-motion-card" className="relative h-full min-h-[420px] overflow-hidden rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_18%_18%,rgba(45,212,191,0.15),transparent_42%),linear-gradient(145deg,rgba(8,20,36,0.95)_0%,rgba(6,14,26,0.98)_100%)] shadow-[0_24px_90px_rgba(2,8,23,0.48)] lg:min-h-0">
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(148,163,184,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.16) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />

      <div className="absolute left-6 right-6 top-8">
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">Inteligencia Assistida</p>
        <p className="mt-2 text-3xl font-semibold leading-tight text-white">Analise, entenda, decida.</p>
      </div>

      <svg className="absolute inset-x-0 bottom-16 top-28 w-full" viewBox="0 0 600 360" fill="none" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 300C80 285 110 210 170 205C230 200 250 260 310 248C370 236 390 170 450 162C510 154 535 188 600 180" stroke="rgba(45,212,191,0.95)" strokeWidth="4" strokeLinecap="round" />
        <path d="M0 328C80 312 110 250 170 244C230 238 255 278 310 270C365 262 395 220 450 215C505 210 540 227 600 222" stroke="rgba(56,189,248,0.72)" strokeWidth="3" strokeLinecap="round" />
      </svg>

      <motion.div className="absolute bottom-14 left-10 h-20 w-7 rounded-t-md bg-cyan-400/30" animate={{ height: [60, 92, 60] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div className="absolute bottom-14 left-22 h-[72px] w-7 rounded-t-md bg-cyan-300/40" animate={{ height: [50, 80, 50] }} transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }} />
      <motion.div className="absolute bottom-14 left-34 h-24 w-7 rounded-t-md bg-teal-300/35" animate={{ height: [72, 110, 72] }} transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut', delay: 0.15 }} />

      <motion.div className="absolute right-16 bottom-20 h-3 w-3 rounded-full bg-cyan-300" animate={{ y: [0, -18, 0], opacity: [0.45, 1, 0.45] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div className="absolute right-28 bottom-28 h-2.5 w-2.5 rounded-full bg-teal-300" animate={{ y: [0, 14, 0], opacity: [0.3, 0.95, 0.3] }} transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }} />
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const canSubmit = watch('email').length > 0 && watch('password').length > 0;

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);
    try {
      await authService.login(data);
      navigate('/');
    } catch (err) {
      const message = extractErrorMessage(err);
      if (message.toLowerCase().includes('network') || message.toLowerCase().includes('timeout')) {
        setError('Não foi possível conectar ao servidor. Verifique a disponibilidade do backend.');
      } else {
        setError(message || 'Credenciais inválidas');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      variant="split"
      aside={<AIFinanceMotionPanel />}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="h-full w-full"
      >
        <AuthLayoutCard data-testid="login-card" className="mx-auto flex h-full w-full max-w-[560px] flex-col overflow-hidden border-0 bg-transparent p-4 shadow-none backdrop-blur-none sm:p-5 md:p-6">
          <div className="mb-4 md:mb-5">
            <h1 className="text-3xl font-bold leading-tight text-white">Entrar</h1>
            <p className="mt-2 text-base text-slate-300">Use seu e-mail cadastrado para acessar sua área financeira.</p>
          </div>

          {error && (
            <Alert variant="danger" className="mb-6" role="alert" aria-live="polite">
              <AlertTitle>Erro de autenticação</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="flex-1 space-y-3 md:space-y-3.5" noValidate>
            <AuthInput
              label="E-mail"
              placeholder="voce@email.com"
              autoComplete="email"
              icon={<Mail className="h-4 w-4" />}
              error={errors.email?.message}
              {...register('email')}
            />

            <PasswordInput
              label="Senha"
              placeholder="Sua senha"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register('password')}
            />

            <div className="flex items-center justify-between gap-3">
              <Checkbox label="Lembrar de mim" />
              <Link to="/forgot-password" className="text-sm font-medium text-cyan-300 transition-colors hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                Esqueci minha senha
              </Link>
            </div>

            <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.18 }}>
              <PrimaryButton type="submit" isLoading={isLoading} disabled={!canSubmit}>
                Entrar
              </PrimaryButton>
            </motion.div>
          </form>

          <div className="mt-3 text-sm text-slate-300 md:mt-4">
            Não possui uma conta?{' '}
            <Link to="/register" className="font-semibold text-cyan-300 transition-colors hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
              Criar conta
            </Link>
          </div>
        </AuthLayoutCard>
      </motion.div>
    </AuthLayout>
  );
}
