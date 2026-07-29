import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, User, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import {
  AuthInput,
  AuthLayout,
  AuthLayoutCard,
  PasswordInput,
  PasswordStrength,
  PrimaryButton,
} from '@/components/auth';
import { authService } from '@/services/authService';
import { extractErrorMessage } from '@/lib/api';

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
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const password = watch('password');
  const canSubmit =
    watch('fullName').trim().length > 1
    && watch('email').length > 0
    && watch('password').length > 0
    && watch('confirmPassword').length > 0;

  const onSubmit = async ({ fullName, email, password }: RegisterFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.register({ fullName, email, password });
      navigate('/login', {
        replace: true,
        state: {
          successMessage: 'Sua conta foi criada. Faça login para continuar.',
          registeredEmail: response.email,
        },
      });
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full"
      >
        <AuthLayoutCard>
          <div className="mb-5 text-center md:mb-6">
            <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl">Criar conta</h1>
            <p className="mt-2 text-base text-slate-300 sm:text-lg">Comece a organizar seu futuro financeiro</p>
          </div>

          {error && (
            <Alert variant="danger" className="mb-6" role="alert" aria-live="polite">
              <AlertTitle>Não foi possível concluir o cadastro</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5 md:space-y-4" noValidate>
            <AuthInput
              label="Nome completo"
              placeholder="Seu nome completo"
              autoComplete="name"
              icon={<User className="h-4 w-4" />}
              error={errors.fullName?.message}
              {...register('fullName')}
            />

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
              placeholder="Crie uma senha segura"
              autoComplete="new-password"
              error={errors.password?.message}
              {...register('password')}
            />

            <PasswordStrength password={password} />

            <PasswordInput
              label="Confirmar senha"
              placeholder="Confirme sua senha"
              autoComplete="new-password"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />

            <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.18 }}>
              <PrimaryButton type="submit" isLoading={isLoading} disabled={!canSubmit} leadingIcon={<UserPlus className="h-4 w-4" />}>
                Criar conta
              </PrimaryButton>
            </motion.div>
          </form>

          <div className="mt-5 text-center text-sm text-slate-300 md:mt-6">
            Já possui uma conta?{' '}
            <Link to="/login" className="font-semibold text-cyan-300 transition-colors hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
              Entrar
            </Link>
          </div>
        </AuthLayoutCard>
      </motion.div>
    </AuthLayout>
  );
}