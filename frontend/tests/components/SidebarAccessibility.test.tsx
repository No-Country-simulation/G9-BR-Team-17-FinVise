import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Sidebar } from '@/components/layout/Sidebar';

describe('acessibilidade do menu mobile', () => {
  it('remove o menu fechado da navegação por teclado e o expõe como diálogo ao abrir', () => {
    const props = {
      onClose: vi.fn(),
      isCollapsed: false,
      onToggleCollapse: vi.fn(),
    };
    const { rerender } = render(
      <MemoryRouter>
        <Sidebar {...props} isOpen={false} />
      </MemoryRouter>
    );

    expect(document.getElementById('app-sidebar')).toHaveAttribute('inert');

    rerender(
      <MemoryRouter>
        <Sidebar {...props} isOpen />
      </MemoryRouter>
    );

    const drawer = screen.getByRole('dialog', { name: 'Menu principal' });
    expect(drawer).not.toHaveAttribute('inert');
    expect(drawer).toHaveAttribute('aria-modal', 'true');
  });
});
