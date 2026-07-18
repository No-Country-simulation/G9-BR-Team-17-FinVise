import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { PluggyConnect } from 'react-pluggy-connect';
import { ArrowLeft, BrainCircuit, Landmark, LockKeyhole, Scale } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { ConnectionSkeleton } from '@/components/skeletons/PageSkeletons';
import { openFinanceService } from '@/services/openFinanceService';
import { extractErrorMessage } from '@/lib/api';
import { ProfileAnalysisModel } from '@/types/analysis';
import { rememberTransactionSource } from '@/hooks/useTransactionSource';

export function OpenFinancePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [model, setModel] = useState<ProfileAnalysisModel>('MACHINE_LEARNING');
  const [connectToken, setConnectToken] = useState<string | null>(null);
  const [includeSandbox, setIncludeSandbox] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: status, isLoading } = useQuery({
    queryKey: ['open-finance', 'status'],
    queryFn: () => openFinanceService.getStatus(),
    retry: false,
  });

  const startConnection = async () => {
    setError(null);
    setIsConnecting(true);
    try {
      const token = await openFinanceService.createConnectToken();
      setConnectToken(token.accessToken);
      setIncludeSandbox(token.includeSandbox);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSuccess = async ({ item }: { item: { id: string } }) => {
    setIsSyncing(true);
    setError(null);
    try {
      const result = await openFinanceService.synchronize(item.id, model);
      rememberTransactionSource('OPEN_FINANCE_PLUGGY');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['analyses'] }),
        queryClient.invalidateQueries({ queryKey: ['import-sources'] }),
      ]);
      navigate(`/analyses/${result.analysisId}`);
    } catch (err) {
      setError(extractErrorMessage(err));
      setConnectToken(null);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
      <div>
        <Link to="/profile">
          <Button variant="ghost" size="sm" className="mb-2 -ml-3">
            <ArrowLeft className="mr-1 h-4 w-4" />Voltar ao perfil
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
            <Landmark className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Importar pelo Open Finance</h1>
            <p className="text-slate-500">Conecte sua instituição, sincronize e analise as transações</p>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="danger">
          <AlertTitle>Falha no Open Finance</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!isLoading && status && !status.configured && (
        <Alert variant="warning">
          <LockKeyhole className="h-5 w-5" />
          <AlertTitle>Credenciais do provedor necessárias</AlertTitle>
          <AlertDescription>
            A integração está pronta, mas este ambiente precisa de PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET no arquivo .env.
            As credenciais ficam somente no backend e nunca são expostas ao navegador.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>1. Escolha o modelo da análise</CardTitle>
          <CardDescription>A análise será gerada automaticamente depois da sincronização.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {[
            { code: 'MACHINE_LEARNING' as const, name: 'Machine Learning', icon: BrainCircuit, description: 'Identifica padrões combinados nos seus dados.' },
            { code: 'FINANCIAL_RULES' as const, name: 'Regras financeiras', icon: Scale, description: 'Resultado determinístico e explicável.' },
          ].map((option) => {
            const Icon = option.icon;
            const selected = model === option.code;
            return (
              <button
                key={option.code}
                type="button"
                onClick={() => setModel(option.code)}
                className={`rounded-xl border-2 p-4 text-left ${selected ? 'border-primary-500 bg-primary-50' : 'border-slate-200'}`}
                aria-pressed={selected}
              >
                <Icon className="mb-2 h-6 w-6 text-primary-600" />
                <p className="font-semibold">{option.name}</p>
                <p className="text-sm text-slate-500">{option.description}</p>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Conecte sua instituição</CardTitle>
          <CardDescription>
            O consentimento e a autenticação acontecem no widget seguro do provedor Pluggy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <ConnectionSkeleton />
          ) : isSyncing ? (
            <div className="flex items-center justify-center gap-3 py-8 text-slate-600">
              <Spinner />Sincronizando, categorizando e analisando transações...
            </div>
          ) : (
            <Button
              className="w-full"
              size="lg"
              onClick={startConnection}
              isLoading={isConnecting}
              disabled={!status?.configured || isConnecting}
            >
              <Landmark className="mr-2 h-5 w-5" />Conectar instituição
            </Button>
          )}
          <p className="text-center text-xs text-slate-500">
            Apenas transações autorizadas são copiadas. Reimportações são deduplicadas pelo identificador do provedor.
          </p>
        </CardContent>
      </Card>

      {connectToken && (
        <PluggyConnect
          connectToken={connectToken}
          includeSandbox={includeSandbox}
          products={['ACCOUNTS', 'TRANSACTIONS']}
          onSuccess={handleSuccess}
          onError={({ message }) => {
            setError(message);
            setConnectToken(null);
          }}
          onClose={() => setConnectToken(null)}
        />
      )}
    </div>
  );
}
