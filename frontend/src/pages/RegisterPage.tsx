import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, Clock3, Mail, User, UserPlus } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import {
  AuthExperiencePanel,
  AuthInput,
  AuthLayout,
  AuthLayoutCard,
  PasswordInput,
  PasswordStrength,
  PrimaryButton,
} from '@/components/auth';
import { authService } from '@/services/authService';
import { extractErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/auth/useTheme';

const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Informe seu nome completo').max(150, 'Nome é muito longo'),
    email: z.string().min(1, 'Informe seu e-mail').email('Informe um e-mail válido'),
    password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres').max(100, 'Senha é muito longa'),
    confirmPassword: z.string().min(1, 'Confirme sua senha'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não conferem',
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const { resolvedTheme } = useTheme();
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const redirectTimeoutRef = useRef<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  });

  const password = watch('password');
  const canSubmit =
    watch('fullName').trim().length > 1
    && watch('email').length > 0
    && watch('password').length > 0
    && watch('confirmPassword').length > 0;

  const onSubmit = async ({ fullName, email, password: submittedPassword }: RegisterFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.register({ fullName, email, password: submittedPassword });
      setSuccessEmail(response.email);
      redirectTimeoutRef.current = window.setTimeout(() => {
        navigate('/login', {
          replace: true,
          state: {
            successMessage: 'Cadastro concluído com sucesso. Faça login para continuar.',
            registeredEmail: response.email,
          },
        });
      }, 1300);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => () => {
    if (redirectTimeoutRef.current !== null) window.clearTimeout(redirectTimeoutRef.current);
  }, []);

  return (
    <AuthLayout variant="reverse" aside={<AuthExperiencePanel mode="register" />}>
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.4, ease: 'easeOut' }}
        className="w-full"
      >
        <AuthLayoutCard className="lg:p-6 xl:p-7">
          <div className="mb-4">
            <div className={cn('mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em]', resolvedTheme === 'dark' ? 'text-cyan-300' : 'text-cyan-700')}>
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              Comece em menos de 2 minutos
            </div>
            <h1 className={cn('text-[1.75rem] font-bold leading-tight tracking-[-0.035em] sm:text-[2rem]', resolvedTheme === 'dark' ? 'text-white' : 'text-slate-950')}>
              Sua jornada começa aqui
            </h1>
            <p className={cn('mt-2 text-[15px] leading-relaxed', resolvedTheme === 'dark' ? 'text-slate-300' : 'text-slate-600')}>
              Crie sua conta e dê o primeiro passo para decisões financeiras melhores.
            </p>
          </div>

          {error && (
            <Alert variant="danger" className="mb-5" role="alert" aria-live="polite">
              <AlertTitle>Não foi possível concluir o cadastro</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3.5 xl:grid-cols-2" noValidate aria-busy={isLoading ? 'true' : 'false'}>
            <div>
              <AuthInput
                label="Nome completo"
                placeholder="Como podemos chamar você?"
                autoComplete="name"
                icon={<User className="h-4 w-4" />}
                error={errors.fullName?.message}
                {...register('fullName')}
              />
            </div>

            <div>
              <AuthInput
                label="E-mail"
                placeholder="voce@email.com"
                autoComplete="email"
                icon={<Mail className="h-4 w-4" />}
                error={errors.email?.message}
                {...register('email')}
              />
            </div>

            <div>
              <PasswordInput
                label="Senha"
                placeholder="Crie uma senha segura"
                autoComplete="new-password"
                error={errors.password?.message}
                {...register('password')}
              />
            </div>

            <div>
              <PasswordInput
                label="Confirmar senha"
                placeholder="Digite a senha novamente"
                autoComplete="new-password"
                error={errors.confirmPassword?.message}
                {...register('confirmPassword')}
              />
            </div>

            <div className="xl:col-span-2">
              <PasswordStrength password={password} />
            </div>

            <motion.div className="xl:col-span-2" whileHover={reduceMotion ? undefined : { y: -2 }} transition={{ duration: 0.18 }}>
              <PrimaryButton type="submit" isLoading={isLoading} disabled={!canSubmit} leadingIcon={<UserPlus className="h-4 w-4" />}>
                Criar minha conta
              </PrimaryButton>
            </motion.div>
          </form>

          <p className={cn('mt-4 flex items-start justify-center gap-2 text-center text-xs leading-relaxed', resolvedTheme === 'dark' ? 'text-slate-400' : 'text-slate-500')}>
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
            Ao continuar, você concorda com o tratamento seguro dos dados necessários para sua conta.
          </p>

          <div className={cn('mt-5 border-t pt-5 text-center text-sm', resolvedTheme === 'dark' ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600')}>
            Já possui uma conta?{' '}
            <Link to="/login" className={cn('rounded-md font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400', resolvedTheme === 'dark' ? 'text-cyan-300 hover:text-cyan-200' : 'text-cyan-700 hover:text-cyan-900')}>
              Entrar
            </Link>
          </div>
        </AuthLayoutCard>
      </motion.div>

      {successEmail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:items-center sm:p-6">
          <div
            role="status"
            aria-live="polite"
            className="w-full max-w-lg rounded-[24px] border border-emerald-300/35 bg-[linear-gradient(180deg,rgba(16,185,129,0.94)_0%,rgba(5,150,105,0.96)_100%)] p-5 text-white shadow-[0_22px_60px_rgba(0,0,0,0.42)]"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
              <div>
                <h2 className="text-lg font-bold">Cadastro concluído</h2>
                <p className="mt-1 text-sm text-emerald-50">
                  Conta criada para {successEmail}. Redirecionando para o login...
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}
