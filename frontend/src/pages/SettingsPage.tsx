import { FormEvent, useState } from 'react';
import { Download, Globe, KeyRound, Moon, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/Alert';
import { useTheme } from '@/components/auth/useTheme';
import { authService } from '@/services/authService';
import { userService } from '@/services/userService';
import { reportService } from '@/services/reportService';
import { extractErrorMessage } from '@/lib/api';

type Feedback = { variant: 'success' | 'danger'; title: string; message: string } | null;

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    if (newPassword.length < 8) {
      setFeedback({ variant: 'danger', title: 'Senha inválida', message: 'A nova senha deve ter pelo menos 8 caracteres.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setFeedback({ variant: 'danger', title: 'Senhas diferentes', message: 'A confirmação deve ser igual à nova senha.' });
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await userService.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setFeedback({ variant: 'success', title: 'Senha atualizada', message: response.message });
    } catch (error) {
      setFeedback({ variant: 'danger', title: 'Não foi possível alterar a senha', message: extractErrorMessage(error) });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const exportReport = async () => {
    const userId = authService.getUserId();
    if (!userId) {
      setFeedback({ variant: 'danger', title: 'Sessão inválida', message: 'Entre novamente para exportar seus dados.' });
      return;
    }
    setFeedback(null);
    setIsExporting(true);
    try {
      await reportService.downloadFinancialReport(userId);
      setFeedback({ variant: 'success', title: 'Relatório exportado', message: 'O arquivo CSV foi preparado para download.' });
    } catch (error) {
      setFeedback({ variant: 'danger', title: 'Falha na exportação', message: extractErrorMessage(error) });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
        <p className="text-slate-500">Aparência, segurança da conta e portabilidade dos seus dados</p>
      </div>

      {feedback && (
        <Alert variant={feedback.variant} role={feedback.variant === 'danger' ? 'alert' : 'status'}>
          <AlertTitle>{feedback.title}</AlertTitle>
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Moon className="h-5 w-5 text-primary-600" />
            Aparência
          </CardTitle>
          <CardDescription>O tema é salvo automaticamente neste dispositivo.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Tema da aplicação</span>
            <Select
              aria-label="Tema da aplicação"
              value={theme}
              onChange={(event) => setTheme(event.target.value as 'dark' | 'light' | 'system')}
              options={[
                { value: 'dark', label: 'Escuro' },
                { value: 'light', label: 'Claro' },
                { value: 'system', label: 'Seguir o sistema' },
              ]}
            />
          </label>
          <div className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Globe className="h-4 w-4" />Idioma
            </span>
            <div className="rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Português (Brasil)
            </div>
            <p className="text-xs text-slate-500">Esta versão oferece conteúdo somente em português do Brasil.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary-600" />
            Segurança da conta
          </CardTitle>
          <CardDescription>Confirme a senha atual antes de definir uma nova.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">Senha atual</span>
              <Input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Nova senha</span>
              <Input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                minLength={8}
                required
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Confirmar nova senha</span>
              <Input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={8}
                required
              />
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" isLoading={isChangingPassword} disabled={!currentPassword || !newPassword || !confirmPassword}>
                <KeyRound className="mr-2 h-4 w-4" />Alterar senha
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary-600" />
            Exportar dados financeiros
          </CardTitle>
          <CardDescription>Baixe receitas, despesas, saldo e totais por categoria em CSV compatível com planilhas.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" onClick={exportReport} isLoading={isExporting}>
            <Download className="mr-2 h-4 w-4" />Baixar relatório CSV
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
