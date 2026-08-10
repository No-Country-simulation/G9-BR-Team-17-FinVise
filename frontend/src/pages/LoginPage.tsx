import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CircleAlert, ShieldCheck } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import {
  AuthExperiencePanel,
  AuthLayout,
  AuthLayoutCard,
  AuthInput,
  Checkbox,
  PasswordInput,
  PrimaryButton,
} from '@/components/auth';
import { authService } from '@/services/authService';
import { extractErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/auth/useTheme';

const loginSchema = z.object({
  email: z.string().min(1, 'Informe seu e-mail').email('Informe um e-mail válido'),
  password: z.string().min(1, 'Informe sua senha'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { resolvedTheme } = useTheme();
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const successMessage = (location.state as { successMessage?: string } | null)?.successMessage;
  const registeredEmail = (location.state as { registeredEmail?: string } | null)?.registeredEmail;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: { email: '', password: '' },
  });

  const canSubmit = watch('email').length > 0 && watch('password').length > 0;
  const hasFieldError = Boolean(errors.email || errors.password);
  const hasLoginError = hasFieldError || Boolean(error);
  const loginErrorId = 'login-form-error';
  const loginErrorMessage = hasFieldError
    ? 'Verifique as informações da conta e tente novamente.'
    : error;

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
      } else if (message.toLowerCase().includes('credenciais') || message.toLowerCase().includes('unauthorized')) {
        setError('E-mail ou senha incorretos. Verifique os dados e tente novamente.');
      } else {
        setError(message || 'Credenciais inválidas');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout variant="split" aside={<AuthExperiencePanel mode="login" />}>
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.4, ease: 'easeOut' }}
        className="w-full"
      >
        <AuthLayoutCard data-testid="login-card">
          <div className="mb-5 text-center">
            <h1 aria-label="Entrar" className={cn('text-[1.75rem] font-bold leading-tight tracking-[-0.035em] sm:text-[2rem]', resolvedTheme === 'dark' ? 'text-white' : 'text-slate-950')}>
              Boas-vindas de volta
            </h1>
            <p className={cn('mx-auto mt-2 max-w-md text-[15px] leading-relaxed', resolvedTheme === 'dark' ? 'text-slate-300' : 'text-slate-600')}>
              Entre para continuar cuidando do seu futuro financeiro.
            </p>
          </div>

          {!error && successMessage && (
            <Alert variant="success" className="mb-5" role="status" aria-live="polite">
              <AlertTitle>Operação concluída</AlertTitle>
              <AlertDescription>
                {successMessage}
                {registeredEmail ? ` (${registeredEmail})` : ''}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate aria-busy={isLoading ? 'true' : 'false'}>
            <div data-testid="login-fields" className={cn(
              'divide-y overflow-hidden rounded-2xl border transition-[border-color,background-color,box-shadow] focus-within:ring-2',
              hasLoginError
                ? resolvedTheme === 'dark'
                  ? 'divide-red-400/80 border-red-400/90 bg-[rgba(69,10,10,0.55)] shadow-[inset_0_1px_0_rgba(254,202,202,0.08)] focus-within:ring-red-400/25'
                  : 'divide-red-500/70 border-red-500 bg-red-50/55 focus-within:ring-red-500/15'
                : resolvedTheme === 'dark'
                  ? 'divide-white/10 border-white/20 bg-slate-950/25 focus-within:ring-cyan-500/25'
                  : 'divide-slate-200 border-slate-300 bg-white/55 focus-within:ring-cyan-500/20'
            )}>
              <AuthInput
                variant="grouped"
                hideFeedback
                label="E-mail"
                placeholder="voce@email.com"
                autoComplete="email"
                aria-describedby={hasLoginError ? loginErrorId : undefined}
                error={errors.email?.message || error || undefined}
                {...register('email', { onChange: () => setError(null) })}
              />

              <PasswordInput
                variant="grouped"
                hideFeedback
                showIcon={false}
                label="Senha"
                placeholder="Sua senha"
                autoComplete="current-password"
                aria-describedby={hasLoginError ? loginErrorId : undefined}
                error={errors.password?.message || error || undefined}
                {...register('password', { onChange: () => setError(null) })}
              />
            </div>

            {loginErrorMessage ? (
              <p
                id={loginErrorId}
                role="alert"
                aria-live="polite"
                className={cn(
                  '-mt-1 flex items-start gap-1.5 rounded-lg px-0.5 text-[13px] font-semibold leading-snug',
                  resolvedTheme === 'dark' ? 'text-red-200' : 'text-red-700'
                )}
              >
                <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {loginErrorMessage}
              </p>
            ) : null}

            <div className="flex items-center justify-between gap-2">
              <Checkbox label="Lembrar de mim" className="shrink-0" />
              <Link to="/forgot-password" className={cn('whitespace-nowrap rounded-md text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 sm:text-sm', resolvedTheme === 'dark' ? 'text-cyan-300 hover:text-cyan-200' : 'text-cyan-700 hover:text-cyan-900')}>
                Esqueci minha senha
              </Link>
            </div>

            <motion.div whileHover={reduceMotion ? undefined : { y: -2 }} transition={{ duration: 0.18 }}>
              <PrimaryButton type="submit" isLoading={isLoading} disabled={!canSubmit}>
                Entrar na FinVise
              </PrimaryButton>
            </motion.div>
          </form>

          <p className={cn('mt-4 flex items-center justify-center gap-2 text-xs', resolvedTheme === 'dark' ? 'text-slate-400' : 'text-slate-500')}>
            <ShieldCheck className="h-4 w-4 text-emerald-500" aria-hidden="true" />
            Seus dados são criptografados e protegidos.
          </p>

          <div className={cn('mt-5 border-t pt-5 text-center text-sm', resolvedTheme === 'dark' ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600')}>
            Ainda não tem uma conta?{' '}
            <Link to="/register" className={cn('rounded-md font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400', resolvedTheme === 'dark' ? 'text-cyan-300 hover:text-cyan-200' : 'text-cyan-700 hover:text-cyan-900')}>
              Criar conta grátis
            </Link>
          </div>
        </AuthLayoutCard>
      </motion.div>
    </AuthLayout>
  );
}
