import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/components/auth/ThemeProvider';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
}));

vi.mock('@/services/authService', () => ({
  authService: { login: mocks.login },
}));

import { LoginPage } from '@/pages/LoginPage';

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.login.mockResolvedValue({ token: 'token', userId: 'user-id' });
  });

  it('keeps grouped fields fixed and displays a single validation message below them', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/login']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <LoginPage />
      </MemoryRouter>,
    );

    const email = screen.getByLabelText('E-mail');
    const password = screen.getByLabelText('Senha');

    await user.type(email, 'a');
    await user.clear(email);
    await user.type(password, 'a');
    await user.clear(password);

    const groupedError = await screen.findByRole('alert');

    expect(groupedError).toHaveTextContent('Verifique as informações da conta e tente novamente.');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.queryByText('Informe seu e-mail')).not.toBeInTheDocument();
    expect(screen.queryByText('Informe sua senha')).not.toBeInTheDocument();
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(password).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAttribute('aria-describedby', 'login-form-error');
    expect(password).toHaveAttribute('aria-describedby', 'login-form-error');
  });

  it('shows rejected credentials below the grouped fields without reloading', async () => {
    const user = userEvent.setup();
    mocks.login.mockRejectedValue({ message: 'Credenciais inválidas', status: 401 });

    render(
      <MemoryRouter initialEntries={['/login']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('E-mail'), 'usuario@exemplo.com');
    await user.type(screen.getByLabelText('Senha'), 'senha-incorreta');
    await user.click(screen.getByRole('button', { name: 'Entrar na FinVise' }));

    const rejectedLogin = await screen.findByRole('alert');
    expect(rejectedLogin).toHaveTextContent('E-mail ou senha incorretos. Verifique os dados e tente novamente.');
    expect(screen.getByTestId('login-fields')).toHaveClass('border-red-500');
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-describedby', 'login-form-error');
    expect(screen.getByLabelText('Senha')).toHaveAttribute('aria-describedby', 'login-form-error');
  });

  it('uses the high-contrast error surface in dark mode', async () => {
    const user = userEvent.setup();
    localStorage.setItem('finvise-theme', 'dark');
    mocks.login.mockRejectedValue({ message: 'Credenciais inválidas', status: 401 });

    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/login']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <LoginPage />
        </MemoryRouter>
      </ThemeProvider>,
    );

    await user.type(screen.getByLabelText('E-mail'), 'usuario@exemplo.com');
    await user.type(screen.getByLabelText('Senha'), 'senha-incorreta');
    await user.click(screen.getByRole('button', { name: 'Entrar na FinVise' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos. Verifique os dados e tente novamente.');
    expect(screen.getByTestId('login-fields')).toHaveClass('border-red-400/90');
    expect(screen.getByTestId('login-fields')).toHaveClass('bg-[rgba(69,10,10,0.55)]');
  });
});
