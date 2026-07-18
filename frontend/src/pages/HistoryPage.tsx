import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, Calendar, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LineChart, LineChartData } from '@/components/charts/LineChart';
import { HistorySkeleton } from '@/components/skeletons/PageSkeletons';
import { formatCurrency } from '@/lib/utils';
import { transactionService } from '@/services/transactionService';
import { useTransactionSource } from '@/hooks/useTransactionSource';
import { TransactionSourceSelector } from '@/components/transactions/TransactionSourceSelector';

interface MonthlyRow extends LineChartData {
  key: string;
  period: string;
}

export function HistoryPage() {
  const { source, setSource } = useTransactionSource();
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['transactions', 'monthly-summary', source],
    queryFn: () => transactionService.getMonthlySummary(source),
    retry: false,
  });

  const monthlyData = useMemo<MonthlyRow[]>(() => data.map((month) => {
    const date = new Date(`${month.month}-01T12:00:00`);
    return {
      key: month.month,
      period: new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date),
      label: new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' }).format(date),
      income: month.income,
      expense: month.expense,
      balance: month.balance,
    };
  }), [data]);

  const averages = useMemo(() => {
    if (monthlyData.length === 0) return { income: 0, expense: 0 };
    return {
      income: monthlyData.reduce((total, month) => total + (month.income ?? 0), 0) / monthlyData.length,
      expense: monthlyData.reduce((total, month) => total + (month.expense ?? 0), 0) / monthlyData.length,
    };
  }, [monthlyData]);

  if (isLoading) {
    return <HistorySkeleton />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Histórico mensal</h1>
          <p className="text-sm text-slate-500 sm:text-base">Evolução real das transações, separada por origem</p>
        </div>
        <TransactionSourceSelector value={source} onChange={setSource} />
      </div>

      {error && (
        <Card><CardContent className="p-5 text-sm text-red-600">Não foi possível carregar o histórico.</CardContent></Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard icon={TrendingUp} label="Média mensal de receitas" value={formatCurrency(averages.income)} color="emerald" />
        <SummaryCard icon={TrendingDown} label="Média mensal de despesas" value={formatCurrency(averages.expense)} color="red" />
        <SummaryCard icon={Calendar} label="Período" value={`${monthlyData.length} ${monthlyData.length === 1 ? 'mês' : 'meses'}`} color="primary" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-primary-600" />Evolução mensal</CardTitle>
          <CardDescription>{source === 'CSV_IMPORT' ? 'Somente transações do arquivo CSV' : 'Somente transações do Open Finance'}</CardDescription>
        </CardHeader>
        <CardContent>
          <LineChart data={monthlyData} emptyMessage="Não há transações nesta origem" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Resumo por mês</CardTitle></CardHeader>
        <CardContent className="p-0">
          {monthlyData.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Nenhuma transação disponível nesta origem.</div>
          ) : (
            <div className="hidden overflow-x-auto xl:block">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                  <tr><th className="px-6 py-3">Mês</th><th className="px-6 py-3 text-right">Receitas</th><th className="px-6 py-3 text-right">Despesas</th><th className="px-6 py-3 text-right">Saldo</th><th className="px-6 py-3 text-center">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthlyData.map((month) => (
                    <tr key={month.key} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium capitalize text-slate-900">{month.period}</td>
                      <td className="px-6 py-4 text-right text-emerald-600">{formatCurrency(month.income ?? 0)}</td>
                      <td className="px-6 py-4 text-right text-red-600">{formatCurrency(month.expense ?? 0)}</td>
                      <td className="px-6 py-4 text-right font-medium text-slate-900">{formatCurrency(month.balance ?? 0)}</td>
                      <td className="px-6 py-4 text-center"><Badge variant={(month.balance ?? 0) >= 0 ? 'success' : 'danger'}>{(month.balance ?? 0) >= 0 ? 'Positivo' : 'Negativo'}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {monthlyData.length > 0 && (
            <div className="divide-y divide-slate-100 xl:hidden">
              {monthlyData.map((month) => (
                <article key={month.key} className="space-y-3 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold capitalize text-slate-900">{month.period}</h3>
                    <Badge variant={(month.balance ?? 0) >= 0 ? 'success' : 'danger'}>
                      {(month.balance ?? 0) >= 0 ? 'Positivo' : 'Negativo'}
                    </Badge>
                  </div>
                  <dl className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm">
                    <div><dt className="text-xs text-slate-500">Receitas</dt><dd className="mt-0.5 truncate font-semibold tabular-nums text-emerald-600">{formatCurrency(month.income ?? 0)}</dd></div>
                    <div><dt className="text-xs text-slate-500">Despesas</dt><dd className="mt-0.5 truncate font-semibold tabular-nums text-red-600">{formatCurrency(month.expense ?? 0)}</dd></div>
                    <div className="col-span-2 border-t border-slate-200 pt-2"><dt className="text-xs text-slate-500">Saldo</dt><dd className="mt-0.5 font-bold tabular-nums text-slate-900">{formatCurrency(month.balance ?? 0)}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: 'emerald' | 'red' | 'primary';
}) {
  const colors = {
    emerald: 'bg-emerald-100 text-emerald-600',
    red: 'bg-red-100 text-red-600',
    primary: 'bg-primary-100 text-primary-600',
  };
  return (
    <Card><CardContent className="p-4 sm:p-5"><div className="flex items-center gap-3">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${colors[color]}`}><Icon className="h-5 w-5" /></div>
      <div className="min-w-0"><p className="text-xs text-slate-500">{label}</p><p className="whitespace-nowrap text-lg font-bold tabular-nums text-slate-900" title={value}>{value}</p></div>
    </div></CardContent></Card>
  );
}
