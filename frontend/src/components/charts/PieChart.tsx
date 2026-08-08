import { useState } from 'react';
import {
  PieChart as RePieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency } from '@/lib/utils';

export interface PieChartData {
  name: string;
  value: number;
  color?: string;
}

interface PieChartProps {
  data: PieChartData[];
  title?: string;
  emptyMessage?: string;
}

interface PreparedPieChartData extends PieChartData {
  color: string;
  percentage: number;
}

const defaultColors = [
  '#2563eb',
  '#7c3aed',
  '#059669',
  '#ea580c',
  '#dc2626',
  '#0891b2',
  '#65a30d',
  '#d97706',
  '#4f46e5',
  '#0d9488',
  '#be123c',
  '#9333ea',
];

const percentageFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const compactCurrencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function PieChart({ data, title, emptyMessage = 'Sem dados para exibir' }: PieChartProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const positiveData = data.filter((item) => Number.isFinite(item.value) && item.value > 0);
  const total = positiveData.reduce((sum, item) => sum + item.value, 0);
  const preparedData: PreparedPieChartData[] = [...positiveData]
    .sort((a, b) => b.value - a.value)
    .map((item, index) => ({
      ...item,
      color: item.color || defaultColors[index % defaultColors.length],
      percentage: total > 0 ? (item.value / total) * 100 : 0,
    }));
  const activeItem = preparedData[activeIndex] || preparedData[0];

  if (preparedData.length === 0) {
    return (
      <div className="flex h-80 w-full items-center justify-center text-sm text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="w-full">
      {title && <h4 className="mb-2 text-center text-sm font-medium text-slate-700">{title}</h4>}

      <div className="mx-auto mb-1 min-h-16 w-full max-w-sm" aria-live="polite">
        <div className="flex h-16 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: activeItem.color }} />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-700">{activeItem.name}</p>
              <p className="truncate text-sm font-bold text-slate-900">{formatCurrency(activeItem.value)}</p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-base font-bold tabular-nums text-slate-900">
              {percentageFormatter.format(activeItem.percentage)}%
            </p>
            <p className="text-[10px] text-slate-500">das despesas</p>
          </div>
        </div>
      </div>

      <div className="relative mx-auto h-52 w-full max-w-sm sm:h-56" role="img" aria-label={`Distribuição de ${preparedData.length} categorias de despesas`}>
        <ResponsiveContainer width="100%" height="100%">
          <RePieChart>
            <Pie
              data={preparedData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="58%"
              outerRadius="82%"
              paddingAngle={1.5}
              cornerRadius={3}
              stroke="#ffffff"
              strokeWidth={2}
              label={false}
              labelLine={false}
              onMouseEnter={(_, index) => setActiveIndex(index)}
            >
              {preparedData.map((entry, index) => (
                <Cell
                  key={entry.name}
                  fill={entry.color}
                  opacity={index === activeIndex ? 1 : 0.82}
                  className="cursor-pointer outline-none transition-opacity"
                />
              ))}
            </Pie>
          </RePieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Total</span>
          <span className="mt-0.5 max-w-28 truncate text-base font-bold text-slate-900" title={formatCurrency(total)}>
            {compactCurrencyFormatter.format(total)}
          </span>
        </div>
      </div>

      <div className="mt-2 border-t border-slate-100 pt-3">
        <div className="grid max-h-36 grid-cols-1 gap-x-5 gap-y-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {preparedData.map((item, index) => (
            <button
              key={item.name}
              type="button"
              onMouseEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
              onClick={() => setActiveIndex(index)}
              className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-1 text-left outline-none transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:ring-2 focus-visible:ring-primary-500"
              title={`${item.name}: ${formatCurrency(item.value)}`}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-600">
                {item.name}
              </span>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-900">
                {percentageFormatter.format(item.percentage)}%
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
