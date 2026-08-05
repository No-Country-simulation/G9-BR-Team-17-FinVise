import { useState } from 'react';
import { Bell, Moon, Shield, Globe, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/Alert';
import { useNotificationPreferences } from '@/components/auth/useNotificationPreferences';
import { useTheme } from '@/components/auth/useTheme';

const languageOptions = [
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'en-US', label: 'English' },
];

export function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const { theme, setTheme } = useTheme();
  const { preferences, updatePreference } = useNotificationPreferences();

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="mx-auto w-full max-w-none space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
        <p className="text-slate-500">Personalize sua experiência no FinVise</p>
      </div>

      {saved && (
        <Alert variant="success">
          <AlertTitle>Sucesso</AlertTitle>
          <AlertDescription>Configurações salvas com sucesso.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary-600" />
            Notificações
          </CardTitle>
          <CardDescription>Escolha quais alertas deseja receber</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3">
            <span className="text-sm text-slate-700">Alertas de gastos</span>
            <input type="checkbox" checked={preferences.spendingAlerts} onChange={(event) => updatePreference('spendingAlerts', event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-primary-600" />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3">
            <span className="text-sm text-slate-700">Relatório semanal</span>
            <input type="checkbox" checked={preferences.weeklyReport} onChange={(event) => updatePreference('weeklyReport', event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-primary-600" />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3">
            <span className="text-sm text-slate-700">Novidades do aplicativo</span>
            <input type="checkbox" checked={preferences.productNews} onChange={(event) => updatePreference('productNews', event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-primary-600" />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary-600" />
            Preferências
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Idioma</label>
            <Select options={languageOptions} defaultValue="pt-BR" />
          </div>
          <label className="block space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Moon className="h-4 w-4" />
              Tema da aplicação
            </span>
            <Select
              aria-label="Tema da aplicação"
              value={theme}
              onChange={(event) => setTheme(event.target.value as 'dark' | 'light' | 'system')}
              options={[
                { value: 'dark', label: 'Escuro' },
                { value: 'light', label: 'Claro' },
                { value: 'system', label: 'Sistema' },
              ]}
            />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary-600" />
            Segurança
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3">
            <span className="text-sm text-slate-700">Autenticação em dois fatores</span>
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-primary-600" />
          </label>
          <Button variant="outline" className="w-full">
            Alterar senha
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave}>
          <Save className="mr-2 h-4 w-4" />
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}
