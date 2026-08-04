import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  email: z.string().trim().min(1, 'Digite seu e-mail para continuar').email('Digite um e-mail válido, como nome@exemplo.com'),
  password: z.string().min(1, 'Digite sua senha para continuar'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const successMessage = typeof location.state === 'object' && location.state && 'successMessage' in location.state
    ? String(location.state.successMessage)
    : null;
  const registeredEmail = typeof location.state === 'object' && location.state && 'registeredEmail' in location.state
    ? String(location.state.registeredEmail)
    : '';

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
        setError('Não foi possível conectar ao servidor agora. Confira sua conexão ou tente novamente em instantes.');
      } else {
        setError(message || 'Não conseguimos entrar com esses dados. Revise e tente novamente.');
      }
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
            <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl">Entrar</h1>
            <p className="mt-2 text-base text-slate-300 sm:text-lg">Use seu e-mail cadastrado para acessar sua área financeira.</p>
          </div>

          {successMessage && (
            <Alert variant="success" className="mb-6" role="status" aria-live="polite">
              <AlertTitle>Cadastro concluído</AlertTitle>
              <AlertDescription>
                {successMessage}
                {registeredEmail ? ` E-mail cadastrado: ${registeredEmail}.` : ''}
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="danger" className="mb-6" role="alert" aria-live="polite">
              <AlertTitle>Erro de autenticação</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 md:space-y-5" noValidate aria-describedby="login-form-tip">
            <p id="login-form-tip" className="text-sm leading-6 text-slate-400">
              Preencha seu e-mail e senha. Campos com erro exibem orientação logo abaixo do campo.
            </p>
            <AuthInput
              label="E-mail"
              placeholder="voce@email.com"
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              autoCapitalize="none"
              icon={<Mail className="h-4 w-4" />}
              helperText="Use o mesmo e-mail cadastrado na plataforma."
              error={errors.email?.message}
              {...register('email')}
            />

            <PasswordInput
              label="Senha"
              placeholder="Sua senha"
              autoComplete="current-password"
              helperText="A senha diferencia letras maiúsculas e minúsculas."
              error={errors.password?.message}
              {...register('password')}
            />

            <div className="flex items-center justify-between gap-3">
              <Checkbox label="Lembrar de mim" helperText="Mantenha sua sessão neste dispositivo pessoal." />
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

          <div className="mt-5 text-center text-sm text-slate-300 md:mt-6">
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
