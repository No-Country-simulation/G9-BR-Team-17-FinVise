import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '@/app/App';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads public routes on demand', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(screen.getByRole('status', { name: 'Carregando página' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('redirects unauthenticated users to login', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('shows the success message passed by registration or password recovery', async () => {
    render(
      <MemoryRouter
        initialEntries={[{
          pathname: '/login',
          state: { successMessage: 'Senha atualizada. Entre com sua nova senha.' },
        }]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AppRoutes />
      </MemoryRouter>
    );

    expect(await screen.findByText('Senha atualizada. Entre com sua nova senha.')).toBeInTheDocument();
  });
});
