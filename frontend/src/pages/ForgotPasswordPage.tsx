import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

const emailSchema = z.object({
  email: z.string().trim().min(1, 'Informe seu e-mail').email('Informe um e-mail válido'),
});

const codeSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Informe o código de 6 dígitos'),
});

const passwordSchema = z
  .object({
    password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres').max(100),
    confirmPassword: z.string().min(1, 'Confirme sua nova senha'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não conferem',
    path: ['confirmPassword'],
  });

type EmailForm = z.infer<typeof emailSchema>;
type CodeForm = z.infer<typeof codeSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;
type RecoveryStep = 'EMAIL' | 'CODE' | 'PASSWORD';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<RecoveryStep>('EMAIL');
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const emailForm = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });
  const codeForm = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: '' },
  });
  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });
  const password = passwordForm.watch('password');

  const run = async (action: () => Promise<void>) => {
    setIsLoading(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const requestCode = ({ email: requestedEmail }: EmailForm) => run(async () => {
    const normalizedEmail = requestedEmail.trim().toLowerCase();
    await authService.requestPasswordReset({ email: normalizedEmail });
    setEmail(normalizedEmail);
    setStep('CODE');
    setNotice('Se o e-mail estiver cadastrado, você receberá um código de 6 dígitos.');
  });

  const validateCode = ({ code }: CodeForm) => run(async () => {
    const response = await authService.validateResetCode({ email, code });
    setResetToken(response.resetToken);
    setStep('PASSWORD');
    setNotice('Código confirmado. Defina agora sua nova senha.');
  });

  const resetPassword = ({ password: newPassword }: PasswordForm) => run(async () => {
    await authService.resetPassword(resetToken, { newPassword });
    navigate('/login', {
      replace: true,
      state: { successMessage: 'Senha atualizada. Entre com sua nova senha.' },
    });
  });

  const resendCode = () => run(async () => {
    await authService.requestPasswordReset({ email });
    codeForm.reset();
    setNotice('Um novo código foi solicitado. O código anterior não é mais válido.');
  });

  const titles = {
    EMAIL: ['Recuperar senha', 'Informe seu e-mail para receber um código de segurança.'],
    CODE: ['Confirmar código', `Digite o código enviado para ${email}.`],
    PASSWORD: ['Criar nova senha', 'Use uma senha diferente da anterior.'],
  } as const;

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
            <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl">{titles[step][0]}</h1>
            <p className="mt-2 text-base text-slate-300 sm:text-lg">{titles[step][1]}</p>
          </div>

          {error && (
            <Alert variant="danger" className="mb-6" role="alert" aria-live="polite">
              <AlertTitle>Não foi possível continuar</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {notice && !error && (
            <Alert variant="success" className="mb-6" role="status" aria-live="polite">
              <AlertTitle>Etapa concluída</AlertTitle>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}

          {step === 'EMAIL' && (
            <form onSubmit={emailForm.handleSubmit(requestCode)} className="space-y-4" noValidate>
              <AuthInput
                label="E-mail"
                placeholder="voce@email.com"
                autoComplete="email"
                icon={<Mail className="h-4 w-4" />}
                error={emailForm.formState.errors.email?.message}
                {...emailForm.register('email')}
              />
              <PrimaryButton type="submit" isLoading={isLoading}>Enviar código</PrimaryButton>
            </form>
          )}

          {step === 'CODE' && (
            <form onSubmit={codeForm.handleSubmit(validateCode)} className="space-y-4" noValidate>
              <AuthInput
                label="Código de segurança"
                placeholder="000000"
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                icon={<KeyRound className="h-4 w-4" />}
                error={codeForm.formState.errors.code?.message}
                {...codeForm.register('code')}
              />
              <PrimaryButton type="submit" isLoading={isLoading}>Validar código</PrimaryButton>
              <SecondaryButton type="button" disabled={isLoading} onClick={resendCode}>
                Solicitar novo código
              </SecondaryButton>
            </form>
          )}

          {step === 'PASSWORD' && (
            <form onSubmit={passwordForm.handleSubmit(resetPassword)} className="space-y-4" noValidate>
              <PasswordInput
                label="Nova senha"
                placeholder="Crie uma senha segura"
                autoComplete="new-password"
                error={passwordForm.formState.errors.password?.message}
                {...passwordForm.register('password')}
              />
              <PasswordStrength password={password} />
              <PasswordInput
                label="Confirmar nova senha"
                placeholder="Repita a nova senha"
                autoComplete="new-password"
                error={passwordForm.formState.errors.confirmPassword?.message}
                {...passwordForm.register('confirmPassword')}
              />
              <PrimaryButton type="submit" isLoading={isLoading}>Atualizar senha</PrimaryButton>
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
