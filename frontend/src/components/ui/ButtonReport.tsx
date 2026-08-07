// components/dashboard/GenerateReportButton.tsx
import { useState } from 'react';
import { FileDown, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TransactionSource } from '@/types/transaction';
import { useGenerateReport } from '@/hooks/useGenerateReport';

interface GenerateReportButtonProps {
  source: TransactionSource;
  importSourceId?: string;
}

export function GenerateReportButton({ source, importSourceId }: GenerateReportButtonProps) {
  const { generate } = useGenerateReport({ source, importSourceId });
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setIsGenerating(true);
    setError(null);
    try {
      generate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível gerar o relatório.');
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={handleClick} variant="secondary" disabled={isGenerating} className="whitespace-nowrap">
        {isGenerating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Gerando...
          </>
        ) : (
          <>
            <FileDown className="mr-2 h-4 w-4" />
            Gerar Relatório
          </>
        )}
      </Button>
      {error && (
        <span className="flex items-center gap-1 text-xs text-red-500">
          <AlertCircle className="h-3 w-3" />
          {error}
        </span>
      )}
    </div>
  );
}