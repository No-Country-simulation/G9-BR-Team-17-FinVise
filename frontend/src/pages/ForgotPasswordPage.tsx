import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import {
  AuthInput,
  AuthLayout,
  AuthLayoutCard,
  PrimaryButton,
} from '@/components/auth';
import { authService } from '@/services/authService';

const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, 'Informe seu e-mail').email('Informe um e-mail válido'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      email: '',
    },
  });

  const canSubmit = watch('email').length > 0;

  const onSubmit = async ({ email }: ForgotPasswordFormData) => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await authService.requestPasswordReset({ email });
      setSuccessMessage('Enviamos um link para seu e-mail.');
    } catch {
      setError('Não foi possível enviar o link.');
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
            <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl">Recuperar senha</h1>
            <p className="mt-2 text-base text-slate-300 sm:text-lg">Informe seu e-mail para receber um link de recuperação.</p>
          </div>

          {error && (
            <Alert variant="danger" className="mb-6" role="alert" aria-live="polite">
              <AlertTitle>Não foi possível enviar o link.</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {successMessage && !error && (
            <Alert variant="success" className="mb-6" role="status" aria-live="polite">
              <AlertTitle>Enviamos um link para seu e-mail.</AlertTitle>
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 md:space-y-5" noValidate>
            <AuthInput
              label="E-mail"
              placeholder="voce@email.com"
              autoComplete="email"
              icon={<Mail className="h-4 w-4" />}
              error={errors.email?.message}
              {...register('email')}
            />

            <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.18 }}>
              <PrimaryButton type="submit" isLoading={isLoading} disabled={!canSubmit}>
                Enviar link de recuperação
              </PrimaryButton>
            </motion.div>
          </form>

          <div className="mt-5 text-center text-sm text-slate-300 md:mt-6">
            <Link
              to="/login"
              className="inline-flex items-center gap-1 font-semibold text-cyan-300 transition-colors hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para o login
            </Link>
          </div>
        </AuthLayoutCard>
      </motion.div>
    </AuthLayout>
  );
}
