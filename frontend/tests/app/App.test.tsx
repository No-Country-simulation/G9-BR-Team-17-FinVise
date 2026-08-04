import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '@/app/App';

const ROUTE_TIMEOUT = 10000;

const { loginMock, registerMock, requestPasswordResetMock, validateResetCodeMock, resetPasswordMock } = vi.hoisted(() => ({
  loginMock: vi.fn(),
  registerMock: vi.fn(),
  requestPasswordResetMock: vi.fn(),
  validateResetCodeMock: vi.fn(),
  resetPasswordMock: vi.fn(),
}));

vi.mock('@/services/authService', () => ({
  authService: {
    login: loginMock,
    register: registerMock,
    requestPasswordReset: requestPasswordResetMock,
    validateResetCode: validateResetCodeMock,
    resetPassword: resetPasswordMock,
    logout: vi.fn(),
    getToken: () => localStorage.getItem('finance_ai_token'),
    getUserId: () => localStorage.getItem('finance_ai_user_id'),
    isAuthenticated: () => !!localStorage.getItem('finance_ai_token'),
  },
}));

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    loginMock.mockReset();
    registerMock.mockReset();
    requestPasswordResetMock.mockReset();
    validateResetCodeMock.mockReset();
    resetPasswordMock.mockReset();
  });

  it('loads public routes on demand', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(screen.getByRole('status', { name: 'Carregando página' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Entrar' }, { timeout: ROUTE_TIMEOUT })).toBeInTheDocument();
  }, ROUTE_TIMEOUT);

  it('loads the register route on demand', async () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Criar conta' }, { timeout: ROUTE_TIMEOUT })).toBeInTheDocument();
  }, ROUTE_TIMEOUT);

  it('loads the forgot password route on demand', async () => {
    render(
      <MemoryRouter initialEntries={['/forgot-password']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Recuperar senha' }, { timeout: ROUTE_TIMEOUT })).toBeInTheDocument();
  }, ROUTE_TIMEOUT);

  it('redirects unauthenticated users to login', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('submits the login form with valid credentials', async () => {
    const user = userEvent.setup();
    loginMock.mockImplementation(async (payload) => {
      localStorage.setItem('finance_ai_token', 'jwt-token');
      localStorage.setItem('finance_ai_user_id', 'user-1');
      return { token: 'jwt-token', ...payload };
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AppRoutes />
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: 'Entrar' });
    await user.type(screen.getByLabelText('E-mail'), 'demo@financeai.com');
    await user.type(screen.getByLabelText('Senha'), '12345678');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith({
        email: 'demo@financeai.com',
        password: '12345678',
      });
    });
  });

  it('shows login validation feedback for invalid email', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AppRoutes />
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: 'Entrar' }, { timeout: ROUTE_TIMEOUT });
    await user.type(screen.getByLabelText('E-mail'), 'email-invalido');
    await user.type(screen.getByLabelText('Senha'), '12345678');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Digite um e-mail válido, como nome@exemplo.com')).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  }, ROUTE_TIMEOUT);

  it('shows the post-register success message on login', async () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/login',
            state: {
              successMessage: 'Sua conta foi criada. Faça login para continuar.',
              registeredEmail: 'novo@financeai.com',
            },
          },
        ]}
      >
        <AppRoutes />
      </MemoryRouter>
    );

    expect(await screen.findByText('Cadastro concluído')).toBeInTheDocument();
    expect(screen.getByText(/E-mail cadastrado: novo@financeai.com./i)).toBeInTheDocument();
  });

  it('submits the register form with matching passwords', async () => {
    const user = userEvent.setup();
    registerMock.mockResolvedValue({ email: 'novo@financeai.com' });

    render(
      <MemoryRouter initialEntries={['/register']}>
        <AppRoutes />
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: 'Criar conta' }, { timeout: ROUTE_TIMEOUT });
    await user.type(screen.getByLabelText('Nome completo'), 'Novo Usuario');
    await user.type(screen.getByLabelText('E-mail'), 'novo@financeai.com');
    await user.type(screen.getByLabelText('Confirmar e-mail'), 'novo@financeai.com');
    await user.type(screen.getByLabelText('Senha'), '12345678');
    await user.type(screen.getByLabelText('Confirmar senha'), '12345678');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith({
        fullName: 'Novo Usuario',
        email: 'novo@financeai.com',
        password: '12345678',
      });
    });

    expect(await screen.findByText('Cadastro concluído')).toBeInTheDocument();
  }, ROUTE_TIMEOUT);

  it('blocks register submission when passwords do not match', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/register']}>
        <AppRoutes />
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: 'Criar conta' });
    await user.type(screen.getByLabelText('Nome completo'), 'Novo Usuario');
    await user.type(screen.getByLabelText('E-mail'), 'novo@financeai.com');
    await user.type(screen.getByLabelText('Confirmar e-mail'), 'novo@financeai.com');
    await user.type(screen.getByLabelText('Senha'), '12345678');
    await user.type(screen.getByLabelText('Confirmar senha'), '87654321');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByText('As senhas digitadas precisam ser iguais')).toBeInTheDocument();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('blocks register submission when emails do not match', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/register']}>
        <AppRoutes />
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: 'Criar conta' });
    await user.type(screen.getByLabelText('Nome completo'), 'Novo Usuario');
    await user.type(screen.getByLabelText('E-mail'), 'novo@financeai.com');
    await user.type(screen.getByLabelText('Confirmar e-mail'), 'outro@financeai.com');
    await user.type(screen.getByLabelText('Senha'), '12345678');
    await user.type(screen.getByLabelText('Confirmar senha'), '12345678');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByText('Os e-mails digitados precisam ser iguais')).toBeInTheDocument();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('submits forgot password with a valid email and advances to code confirmation', async () => {
    const user = userEvent.setup();
    requestPasswordResetMock.mockResolvedValue({
      message: 'Se o e-mail informado estiver cadastrado, você receberá um código de verificação em instantes.',
    });

    render(
      <MemoryRouter initialEntries={['/forgot-password']}>
        <AppRoutes />
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: 'Recuperar senha' });
    await user.type(screen.getByLabelText('E-mail'), 'demo@financeai.com');
    await user.click(screen.getByRole('button', { name: 'Enviar código de verificação' }));

    await waitFor(() => {
      expect(requestPasswordResetMock).toHaveBeenCalledWith({ email: 'demo@financeai.com' });
    });

    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Solicitação recebida')).toBeInTheDocument();
    expect(screen.getByText('Se o e-mail informado estiver cadastrado, você receberá um código de verificação em instantes.')).toBeInTheDocument();
    expect(screen.getByLabelText('Código de verificação')).toBeInTheDocument();
  });

  it('validates the reset code and submits the new password', async () => {
    const user = userEvent.setup();
    requestPasswordResetMock.mockResolvedValue({
      message: 'Se o e-mail informado estiver cadastrado, você receberá um código de verificação em instantes.',
    });
    validateResetCodeMock.mockResolvedValue({ resetToken: 'reset-token' });
    resetPasswordMock.mockResolvedValue({ message: 'Senha atualizada com sucesso.' });

    render(
      <MemoryRouter initialEntries={['/forgot-password']}>
        <AppRoutes />
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: 'Recuperar senha' });
    await user.type(screen.getByLabelText('E-mail'), 'demo@financeai.com');
    await user.click(screen.getByRole('button', { name: 'Enviar código de verificação' }));

    await screen.findByLabelText('Código de verificação');
    await user.type(screen.getByLabelText('Código de verificação'), '123456');
    await user.type(screen.getByLabelText('Nova senha'), 'NovaSenha#2026');
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'NovaSenha#2026');
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }));

    await waitFor(() => {
      expect(validateResetCodeMock).toHaveBeenCalledWith({
        email: 'demo@financeai.com',
        code: '123456',
      });
    });

    expect(resetPasswordMock).toHaveBeenCalledWith('reset-token', {
      newPassword: 'NovaSenha#2026',
    });
    expect(await screen.findByText('Senha atualizada com sucesso.')).toBeInTheDocument();
  });
});
