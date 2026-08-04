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
    fullName: z.string().trim().min(2, 'Digite seu nome e sobrenome').max(150, 'Seu nome está longo demais para este campo'),
    email: z.string().trim().min(1, 'Digite seu e-mail para criar a conta').email('Digite um e-mail válido, como nome@exemplo.com'),
    confirmEmail: z.string().trim().min(1, 'Repita seu e-mail para confirmação').email('Digite um e-mail válido, como nome@exemplo.com'),
    password: z.string().min(8, 'Crie uma senha com pelo menos 8 caracteres').max(100, 'Sua senha ultrapassou o limite de 100 caracteres'),
    confirmPassword: z.string().min(1, 'Repita a senha para confirmar'),
  })
  .refine((data) => data.email === data.confirmEmail, {
    message: 'Os e-mails digitados precisam ser iguais',
    path: ['confirmEmail'],
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas digitadas precisam ser iguais',
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
      confirmEmail: '',
      password: '',
      confirmPassword: '',
    },
  });

  const password = watch('password');
  const canSubmit =
    watch('fullName').trim().length > 1
    && watch('email').length > 0
    && watch('confirmEmail').length > 0
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
            <p className="mt-2 text-base text-slate-300 sm:text-lg">Configure seu acesso e comece a organizar sua vida financeira com clareza.</p>
          </div>

          {error && (
            <Alert variant="danger" className="mb-6" role="alert" aria-live="polite">
              <AlertTitle>Não foi possível concluir o cadastro</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5 md:space-y-4" noValidate aria-describedby="register-form-tip">
            <p id="register-form-tip" className="text-sm leading-6 text-slate-400">
              Use dados reais para facilitar sua identificação e recuperação de acesso depois.
            </p>
            <AuthInput
              label="Nome completo"
              placeholder="Seu nome completo"
              autoComplete="name"
              icon={<User className="h-4 w-4" />}
              helperText="Informe pelo menos nome e sobrenome." 
              error={errors.fullName?.message}
              {...register('fullName')}
            />

            <AuthInput
              label="E-mail"
              placeholder="voce@email.com"
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              autoCapitalize="none"
              icon={<Mail className="h-4 w-4" />}
              helperText="Esse e-mail será usado para login e recuperação de senha."
              error={errors.email?.message}
              {...register('email')}
            />

            <AuthInput
              label="Confirmar e-mail"
              placeholder="Repita seu e-mail"
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              autoCapitalize="none"
              icon={<Mail className="h-4 w-4" />}
              helperText="Digite novamente o e-mail para evitar erro de cadastro."
              error={errors.confirmEmail?.message}
              {...register('confirmEmail')}
            />

            <PasswordInput
              label="Senha"
              placeholder="Crie uma senha segura"
              autoComplete="new-password"
              helperText="Use letras, números e símbolo. Espaços não contam como caractere especial."
              error={errors.password?.message}
              {...register('password')}
            />

            <PasswordStrength password={password} />

            <PasswordInput
              label="Confirmar senha"
              placeholder="Confirme sua senha"
              autoComplete="new-password"
              helperText="Repita exatamente a mesma senha digitada acima."
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