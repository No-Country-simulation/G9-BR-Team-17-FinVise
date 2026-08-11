import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthExperiencePanel } from '@/components/auth/AuthExperiencePanel';

describe('AuthExperiencePanel', () => {
  it('adapta a mensagem ao contexto de autenticação', () => {
    const { rerender } = render(<AuthExperiencePanel mode="login" />);

    expect(screen.getByRole('heading', { name: 'Seu dinheiro, finalmente em perspectiva.' })).toBeInTheDocument();
    expect(screen.getByTestId('finance-motion-card')).toBeInTheDocument();

    rerender(<AuthExperiencePanel mode="register" />);
    expect(screen.getByRole('heading', { name: 'Seu próximo capítulo financeiro começa agora.' })).toBeInTheDocument();

    rerender(<AuthExperiencePanel mode="recovery" />);
    expect(screen.getByRole('heading', { name: 'Seu acesso volta. Sua segurança permanece.' })).toBeInTheDocument();
  });
});
