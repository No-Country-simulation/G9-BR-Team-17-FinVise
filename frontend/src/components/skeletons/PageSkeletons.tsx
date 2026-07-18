import { Skeleton, SkeletonRegion } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';

function HeaderSkeleton({ action = true }: { action?: boolean }) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {action && <Skeleton className="h-10 w-full xl:w-56" />}
    </div>
  );
}

function MetricGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  );
}

function PanelSkeleton({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Skeleton className={cn('w-full rounded-xl', compact ? 'h-44' : 'h-[23rem]', className)} />
  );
}

export function DashboardSkeleton() {
  return (
    <SkeletonRegion className="space-y-6" label="Carregando dashboard financeiro">
      <HeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <PanelSkeleton className="xl:col-span-2" />
        <PanelSkeleton />
      </div>
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <PanelSkeleton compact />
        <PanelSkeleton compact />
      </div>
    </SkeletonRegion>
  );
}

export function AnalysisResultSkeleton() {
  return (
    <SkeletonRegion className="space-y-6" label="Carregando resultado da análise">
      <HeaderSkeleton action={false} />
      <PanelSkeleton compact />
      <div className="grid gap-4 lg:grid-cols-2">
        <PanelSkeleton />
        <PanelSkeleton />
      </div>
      <PanelSkeleton compact />
    </SkeletonRegion>
  );
}

export function ProfileSkeleton() {
  return (
    <SkeletonRegion className="space-y-6" label="Carregando perfil financeiro">
      <HeaderSkeleton />
      <Skeleton className="h-40 w-full rounded-xl" />
      <MetricGridSkeleton count={4} />
    </SkeletonRegion>
  );
}

export function HistorySkeleton() {
  return (
    <SkeletonRegion className="space-y-6" label="Carregando histórico mensal">
      <HeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      <PanelSkeleton />
      <TransactionTableSkeleton rows={5} />
    </SkeletonRegion>
  );
}

export function RecommendationListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <SkeletonRegion className="grid gap-4" label="Carregando recomendações">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="h-28 w-full rounded-xl" />
      ))}
    </SkeletonRegion>
  );
}

export function TransactionTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <SkeletonRegion className="w-full" label="Carregando transações">
      <Skeleton className={cn('w-full rounded-xl', rows <= 5 ? 'h-80' : 'h-[28rem]')} />
    </SkeletonRegion>
  );
}

export function InlineMetricsSkeleton() {
  return (
    <SkeletonRegion label="Carregando dados disponíveis">
      <Skeleton className="h-20 w-full rounded-xl" />
    </SkeletonRegion>
  );
}

export function ConnectionSkeleton() {
  return (
    <SkeletonRegion label="Verificando integração Open Finance">
      <Skeleton className="h-20 w-full rounded-xl" />
    </SkeletonRegion>
  );
}

export function ImportSourcesSkeleton() {
  return (
    <SkeletonRegion className="space-y-6" label="Carregando fontes importadas">
      <HeaderSkeleton />
      <MetricGridSkeleton count={4} />
      <Skeleton className="h-11 w-full rounded-xl" />
      <Skeleton className="h-[28rem] w-full rounded-xl" />
    </SkeletonRegion>
  );
}
