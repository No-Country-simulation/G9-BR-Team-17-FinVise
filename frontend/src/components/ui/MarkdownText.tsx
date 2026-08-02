import React from 'react';

interface MarkdownTextProps {
  content: string;
  className?: string;
}

export const MarkdownText: React.FC<MarkdownTextProps> = ({ content, className = '' }) => {
  if (!content) return null;

  // Dividir em blocos de parágrafos por linhas duplas
  const blocks = content.split(/\n\s*\n/);

  return (
    <div className={`space-y-3 text-sm leading-relaxed ${className}`}>
      {blocks.map((block, bIdx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        const lines = trimmed.split('\n');
        // Verifica se todas as linhas representam uma lista numerada ou de tópicos
        const isList = lines.length > 1 && lines.every((line) => /^\s*(\d+\.|\*|-)\s+/.test(line.trim()));

        if (isList) {
          return (
            <ul key={bIdx} className="my-2 space-y-2 pl-0.5">
              {lines.map((line, lIdx) => {
                const match = line.match(/^\s*(\d+\.|\*|-)\s+(.*)/);
                const prefix = match ? match[1] : '';
                const cleanLine = match ? match[2] : line;

                return (
                  <li key={lIdx} className="flex items-start gap-2">
                    {/^\d+\./.test(prefix) ? (
                      <span className="mt-0.5 min-w-4 text-xs font-semibold text-primary-600">
                        {prefix}
                      </span>
                    ) : (
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />
                    )}
                    <span className="flex-1">{formatInline(cleanLine)}</span>
                  </li>
                );
              })}
            </ul>
          );
        }

        // Títulos (# Título)
        if (trimmed.startsWith('#')) {
          const headerText = trimmed.replace(/^#+\s*/, '');
          return (
            <h3 key={bIdx} className="mt-3 text-base font-bold text-slate-900">
              {formatInline(headerText)}
            </h3>
          );
        }

        // Parágrafo padrão (pode conter linhas simples)
        return (
          <div key={bIdx} className="space-y-1.5">
            {lines.map((line, lIdx) => {
              // Se uma linha isolada for um item de lista
              const singleMatch = line.match(/^\s*(\d+\.|\*|-)\s+(.*)/);
              if (singleMatch) {
                const prefix = singleMatch[1];
                const cleanLine = singleMatch[2];
                return (
                  <div key={lIdx} className="flex items-start gap-2 my-1">
                    {/^\d+\./.test(prefix) ? (
                      <span className="mt-0.5 min-w-4 text-xs font-semibold text-primary-600">
                        {prefix}
                      </span>
                    ) : (
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />
                    )}
                    <span className="flex-1">{formatInline(cleanLine)}</span>
                  </div>
                );
              }

              return (
                <p key={lIdx} className="leading-relaxed">
                  {formatInline(line)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

function formatInline(text: string): React.ReactNode[] {
  // Processa **negrito** e *itálico*
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={i} className="font-bold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={i} className="italic text-slate-800">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}
