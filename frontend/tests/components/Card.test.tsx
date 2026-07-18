import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';

describe('Card', () => {
  it('renders card with title, description and content', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Título do Card</CardTitle>
          <CardDescription>Descrição do card</CardDescription>
        </CardHeader>
        <CardContent>Conteúdo</CardContent>
      </Card>
    );

    expect(screen.getByText('Título do Card')).toBeInTheDocument();
    expect(screen.getByText('Descrição do card')).toBeInTheDocument();
    expect(screen.getByText('Conteúdo')).toBeInTheDocument();
  });
});
