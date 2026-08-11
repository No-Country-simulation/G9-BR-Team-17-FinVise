import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('mantém os grupos recolhidos por padrão e abre somente um por vez', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <Sidebar
          isOpen
          onClose={vi.fn()}
          isCollapsed={false}
          onToggleCollapse={vi.fn()}
        />
      </MemoryRouter>
    );

    const importToggle = screen.getByRole('button', { name: 'Alternar submenu de importações' });
    const insightsToggle = screen.getByRole('button', { name: 'Alternar submenu de IA e insights' });

    expect(importToggle).toHaveAttribute('aria-expanded', 'false');
    expect(insightsToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Principal')).not.toBeInTheDocument();

    await user.click(importToggle);
    expect(importToggle).toHaveAttribute('aria-expanded', 'true');
    expect(insightsToggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(insightsToggle);
    expect(importToggle).toHaveAttribute('aria-expanded', 'false');
    expect(insightsToggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('expande automaticamente o grupo da rota atual', () => {
    render(
      <MemoryRouter initialEntries={['/import/sources']}>
        <Sidebar
          isOpen
          onClose={vi.fn()}
          isCollapsed={false}
          onToggleCollapse={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: 'Alternar submenu de importações' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Alternar submenu de IA e insights' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });
});
