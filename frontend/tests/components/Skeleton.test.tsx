import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Skeleton, SkeletonRegion } from '@/components/ui/Skeleton';

describe('Skeleton', () => {
  it('mantém os elementos visuais ocultos para leitores de tela', () => {
    const { container } = render(<Skeleton className="h-8" />);

    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.firstChild).toHaveClass('skeleton-shimmer', 'h-8');
  });

  it('informa o estado de carregamento de forma acessível', () => {
    render(
      <SkeletonRegion label="Carregando resumo financeiro">
        <Skeleton />
      </SkeletonRegion>
    );

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Carregando resumo financeiro')).toBeInTheDocument();
  });
});
