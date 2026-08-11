import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Check, KeyRound, Mail, ShieldCheck } from 'lucide-react';
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
  SecondaryButton,
} from '@/components/auth';
import { authService } from '@/services/authService';
import { extractErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/auth/useTheme';

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

const steps: RecoveryStep[] = ['EMAIL', 'CODE', 'PASSWORD'];
const stepLabels = ['E-mail', 'Código', 'Nova senha'];

export function ForgotPasswordPage() {
  const { resolvedTheme } = useTheme();
  const reduceMotion = useReducedMotion();
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
  const activeStep = steps.indexOf(step);

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
    EMAIL: ['Recupere seu acesso', 'Informe seu e-mail e enviaremos um código de segurança.'],
    CODE: ['Confirmar código', `Digite os 6 números enviados para ${email}.`],
    PASSWORD: ['Criar nova senha', 'Escolha uma senha segura e diferente da anterior.'],
  } as const;

  return (
    <AuthLayout variant="focus" aside={<AuthExperiencePanel mode="recovery" />}>
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.4, ease: 'easeOut' }}
        className="w-full"
      >
        <AuthLayoutCard>
          <div className="mb-5">
            <div className={cn('mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em]', resolvedTheme === 'dark' ? 'text-cyan-300' : 'text-cyan-700')}>
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Recuperação protegida
            </div>
            <h1 className={cn('text-[1.75rem] font-bold leading-tight tracking-[-0.035em] sm:text-[2rem]', resolvedTheme === 'dark' ? 'text-white' : 'text-slate-950')}>
              {titles[step][0]}
            </h1>
            <p className={cn('mt-2 text-[15px] leading-relaxed', resolvedTheme === 'dark' ? 'text-slate-300' : 'text-slate-600')}>
              {titles[step][1]}
            </p>
          </div>

          <ol className="mb-5 flex items-center" aria-label="Etapas da recuperação de senha">
            {steps.map((item, index) => {
              const isComplete = index < activeStep;
              const isCurrent = index === activeStep;
              return (
                <li key={item} className={cn('flex items-center', index < steps.length - 1 && 'flex-1')} aria-current={isCurrent ? 'step' : undefined}>
                  <div className="flex min-w-0 flex-col items-center gap-1.5">
                    <span
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition-colors',
                        isComplete || isCurrent
                          ? 'border-cyan-500 bg-cyan-500 text-slate-950'
                          : resolvedTheme === 'dark' ? 'border-white/15 bg-white/5 text-slate-500' : 'border-slate-200 bg-slate-100 text-slate-500'
                      )}
                    >
                      {isComplete ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
                    </span>
                    <span className={cn('hidden text-[11px] font-semibold min-[390px]:block', isCurrent ? resolvedTheme === 'dark' ? 'text-cyan-200' : 'text-cyan-800' : resolvedTheme === 'dark' ? 'text-slate-500' : 'text-slate-500')}>
                      {stepLabels[index]}
                    </span>
                  </div>
                  {index < steps.length - 1 ? (
                    <span className={cn('mx-2 mb-5 h-px flex-1 transition-colors min-[390px]:mb-6', index < activeStep ? 'bg-cyan-500' : resolvedTheme === 'dark' ? 'bg-white/10' : 'bg-slate-200')} />
                  ) : null}
                </li>
              );
            })}
          </ol>

          {error && (
            <Alert variant="danger" className="mb-5" role="alert" aria-live="polite">
              <AlertTitle>Não foi possível continuar</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {notice && !error && (
            <Alert variant="success" className="mb-5" role="status" aria-live="polite">
              <AlertTitle>Etapa concluída</AlertTitle>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}

          {step === 'EMAIL' && (
            <form onSubmit={emailForm.handleSubmit(requestCode)} className="space-y-4" noValidate aria-busy={isLoading ? 'true' : 'false'}>
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
            <form onSubmit={codeForm.handleSubmit(validateCode)} className="space-y-4" noValidate aria-busy={isLoading ? 'true' : 'false'}>
              <AuthInput
                label="Código de segurança"
                placeholder="000000"
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                className="text-center text-xl font-bold tracking-[0.45em]"
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
            <form onSubmit={passwordForm.handleSubmit(resetPassword)} className="space-y-4" noValidate aria-busy={isLoading ? 'true' : 'false'}>
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

          <div className={cn('mt-5 border-t pt-5 text-center text-sm', resolvedTheme === 'dark' ? 'border-white/10' : 'border-slate-200')}>
            <Link
              to="/login"
              className={cn('inline-flex items-center gap-1 rounded-md font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400', resolvedTheme === 'dark' ? 'text-cyan-300 hover:text-cyan-200' : 'text-cyan-700 hover:text-cyan-900')}
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
