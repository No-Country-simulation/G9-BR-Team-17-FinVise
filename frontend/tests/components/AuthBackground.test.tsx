import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthBackground } from '@/components/auth/Background';

describe('AuthBackground', () => {
  it('renderiza partículas somente quando solicitado pelo fluxo de autenticação', () => {
    const { container, rerender } = render(<AuthBackground />);

    expect(container.querySelectorAll('.finvise-particle')).toHaveLength(0);

    rerender(<AuthBackground showParticles />);

    expect(container.querySelectorAll('.finvise-particle')).toHaveLength(14);
  });
});
