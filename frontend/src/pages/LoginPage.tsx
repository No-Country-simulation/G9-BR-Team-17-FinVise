import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Wallet, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';

import { authService } from '@/services/authService';
import { extractErrorMessage } from '@/lib/api';

const loginSchema = z.object({
  email: z.string().min(1, 'Informe o e-mail').email('Informe um e-mail válido'),
  password: z.string().min(1, 'Informe a senha'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const fillDemoCredentials = () => {
    setValue('email', 'demo@financeai.com');
    setValue('password', 'demo123');
  };

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);
    try {
      await authService.login(data);
      navigate('/');
    } catch (err) {
      const message = extractErrorMessage(err);
      if (message.toLowerCase().includes('network') || message.toLowerCase().includes('timeout')) {
        setError('Não foi possível conectar ao servidor. Verifique se o backend está disponível.');
      } else {
        setError(message || 'Credenciais inválidas');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-lg sm:p-8">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-600 text-white">
            <Wallet className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Finance AI</h1>
          <p className="text-sm text-slate-500">Assistente inteligente para suas finanças</p>
        </div>

        {error && (
          <Alert variant="danger" className="mb-6">
            <AlertTitle>Erro de autenticação</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">E-mail</label>
            <Input
              type="email"
              placeholder="demo@financeai.com"
              autoComplete="email"
              {...register('email')}
              error={errors.email?.message}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Senha</label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="•••••••"
                {...register('password')}
                error={errors.password?.message}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full" isLoading={isLoading}>
            {isLoading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
          <p className="text-xs text-slate-500">Acesso de demonstração</p>
          <p className="text-sm font-medium text-slate-700">
            E-mail: demo@financeai.com / Senha: demo123
          </p>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="mt-1 h-auto p-0 text-xs"
            onClick={fillDemoCredentials}
          >
            Preencher credenciais demo
          </Button>
        </div>
      </div>
    </div>
  );
}
