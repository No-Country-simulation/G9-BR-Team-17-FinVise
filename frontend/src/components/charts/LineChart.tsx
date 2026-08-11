import {
  LineChart as ReLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { formatCurrency } from '@/lib/utils';

export interface LineChartData {
  label: string;
  income?: number;
  expense?: number;
  balance?: number;
}

interface LineChartProps {
  data: LineChartData[];
  title?: string;
  emptyMessage?: string;
}

export function LineChart({ data, title, emptyMessage = 'Sem dados para exibir' }: LineChartProps) {
  const hasData = data.length > 0;
  const showDots = data.length <= 12;
  const compactCurrency = new Intl.NumberFormat('pt-BR', {
    notation: 'compact',
    maximumFractionDigits: 1,
  });

  return (
    <div className="h-64 w-full sm:h-80">
      {title && <h4 className="mb-2 text-center text-sm font-medium text-slate-700">{title}</h4>}
      {hasData ? (
        <ResponsiveContainer width="100%" height="100%">
          <ReLineChart data={data} margin={{ top: 10, right: 4, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={24} />
            <YAxis
              width={58}
              tick={{ fontSize: 10 }}
              tickFormatter={(value) => `R$ ${compactCurrency.format(Number(value))}`}
            />
            <Tooltip
              wrapperClassName="chart-tooltip"
              formatter={(value) => formatCurrency(Number(value ?? 0))}
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#0f172a',
              }}
              labelStyle={{ color: '#0f172a', fontWeight: 700 }}
              itemStyle={{ color: '#0f172a', fontWeight: 500 }}
            />
            <Legend />
            <Line type="linear" dataKey="income" name="Receitas" stroke="#10b981" strokeWidth={2} dot={showDots} activeDot={{ r: 5 }} />
            <Line type="linear" dataKey="expense" name="Despesas" stroke="#ef4444" strokeWidth={2} dot={showDots} activeDot={{ r: 5 }} />
            <Line type="linear" dataKey="balance" name="Saldo" stroke="#078da2" strokeWidth={2} dot={showDots} activeDot={{ r: 5 }} />
          </ReLineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-slate-500">{emptyMessage}</div>
      )}
    </div>
  );
}
