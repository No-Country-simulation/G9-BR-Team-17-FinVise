import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, KeyRound, Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import {
  AuthInput,
  AuthLayout,
  AuthLayoutCard,
  PasswordInput,
  PasswordStrength,
  PrimaryButton,
  SecondaryButton,
} from '@/components/auth';
import { authService } from '@/services/authService';
import { extractErrorMessage } from '@/lib/api';

const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, 'Digite o e-mail vinculado à sua conta').email('Digite um e-mail válido, como nome@exemplo.com'),
});

const resetPasswordSchema = z
  .object({
    code: z.string().trim().length(6, 'Digite o código de 6 dígitos enviado para seu e-mail'),
    newPassword: z.string().min(8, 'Crie uma nova senha com pelo menos 8 caracteres').max(100, 'Sua senha ultrapassou o limite de 100 caracteres'),
    confirmPassword: z.string().min(1, 'Repita a nova senha para confirmar'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'As senhas digitadas precisam ser iguais',
    path: ['confirmPassword'],
  });

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export function ForgotPasswordPage() {
  const [step, setStep] = useState<'request' | 'confirm'>('request');
  const [submittedEmail, setSubmittedEmail] = useState('');
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

  const {
    register: registerReset,
    handleSubmit: handleResetSubmit,
    watch: watchReset,
    reset: resetResetForm,
    formState: { errors: resetErrors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      code: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const canSubmit = watch('email').length > 0;
  const newPassword = watchReset('newPassword');
  const canResetSubmit =
    watchReset('code').trim().length > 0
    && watchReset('newPassword').length > 0
    && watchReset('confirmPassword').length > 0;

  const onSubmit = async ({ email }: ForgotPasswordFormData) => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await authService.requestPasswordReset({ email });
      setSubmittedEmail(email.trim());
      setStep('confirm');
      setSuccessMessage(response.message);
      resetResetForm();
    } catch (err) {
      setError(extractErrorMessage(err) || 'Não foi possível iniciar a recuperação agora. Tente novamente em alguns instantes.');
    } finally {
      setIsLoading(false);
    }
  };

  const onResetPassword = async ({ code, newPassword }: ResetPasswordFormData) => {
    if (!submittedEmail) {
      setError('Informe o e-mail novamente para solicitar um novo código.');
      setStep('request');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { resetToken } = await authService.validateResetCode({
        email: submittedEmail,
        code: code.trim(),
      });
      const response = await authService.resetPassword(resetToken, { newPassword });
      setSuccessMessage(response.message);
      resetResetForm();
    } catch (err) {
      setError(extractErrorMessage(err) || 'Não foi possível redefinir a senha com o código informado.');
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
            <p className="mt-2 text-base text-slate-300 sm:text-lg">
              {step === 'request'
                ? 'Informe seu e-mail para receber um código de verificação.'
                : 'Digite o código recebido e escolha sua nova senha.'}
            </p>
          </div>

          {error && (
            <Alert variant="danger" className="mb-6" role="alert" aria-live="polite">
              <AlertTitle>Não foi possível iniciar a recuperação</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {successMessage && !error && (
            <Alert variant="success" className="mb-6" role="status" aria-live="polite">
              <AlertTitle>Solicitação recebida</AlertTitle>
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}

          {step === 'request' ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 md:space-y-5" noValidate aria-describedby="forgot-form-tip">
              <p id="forgot-form-tip" className="text-sm leading-6 text-slate-400">
                Por segurança, o retorno é o mesmo mesmo quando o e-mail não está cadastrado.
              </p>
              <AuthInput
                label="E-mail"
                placeholder="voce@email.com"
                autoComplete="email"
                inputMode="email"
                spellCheck={false}
                autoCapitalize="none"
                icon={<Mail className="h-4 w-4" />}
                helperText="Use o mesmo e-mail utilizado no login."
                error={errors.email?.message}
                {...register('email')}
              />

              <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.18 }}>
                <PrimaryButton type="submit" isLoading={isLoading} disabled={!canSubmit}>
                  Enviar código de verificação
                </PrimaryButton>
              </motion.div>
            </form>
          ) : (
            <form onSubmit={handleResetSubmit(onResetPassword)} className="space-y-4 md:space-y-5" noValidate aria-describedby="reset-form-tip">
              <p id="reset-form-tip" className="text-sm leading-6 text-slate-400">
                O código expira em 5 minutos. Após 5 tentativas inválidas, o processo é bloqueado temporariamente.
              </p>

              <AuthInput
                label="E-mail"
                value={submittedEmail}
                readOnly
                autoComplete="email"
                icon={<Mail className="h-4 w-4" />}
                helperText="Este é o e-mail usado para validar o código enviado."
              />

              <AuthInput
                label="Código de verificação"
                placeholder="000000"
                inputMode="numeric"
                autoComplete="one-time-code"
                icon={<KeyRound className="h-4 w-4" />}
                helperText="Digite os 6 dígitos recebidos no e-mail."
                error={resetErrors.code?.message}
                {...registerReset('code')}
              />

              <PasswordInput
                label="Nova senha"
                placeholder="Crie sua nova senha"
                autoComplete="new-password"
                helperText="Use pelo menos 8 caracteres com letras, número e caractere especial válido."
                error={resetErrors.newPassword?.message}
                {...registerReset('newPassword')}
              />

              <PasswordStrength password={newPassword} />

              <PasswordInput
                label="Confirmar nova senha"
                placeholder="Repita a nova senha"
                autoComplete="new-password"
                helperText="Repita exatamente a senha digitada acima."
                error={resetErrors.confirmPassword?.message}
                {...registerReset('confirmPassword')}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.18 }}>
                  <PrimaryButton type="submit" isLoading={isLoading} disabled={!canResetSubmit}>
                    Redefinir senha
                  </PrimaryButton>
                </motion.div>
                <SecondaryButton
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    setStep('request');
                    setError(null);
                    setSuccessMessage(null);
                  }}
                >
                  Solicitar novo código
                </SecondaryButton>
              </div>
            </form>
          )}

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
