import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  validateResetCode: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock('@/services/authService', () => ({
  authService: mocks,
}));

import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requestPasswordReset.mockResolvedValue({ message: 'ok' });
    mocks.validateResetCode.mockResolvedValue({ resetToken: 'reset-token' });
    mocks.resetPassword.mockResolvedValue({ message: 'ok' });
  });

  it('completes email, code and new password steps', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/forgot-password']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('E-mail'), 'User@Example.com');
    await user.click(screen.getByRole('button', { name: 'Enviar código' }));
    expect(await screen.findByRole('heading', { name: 'Confirmar código' })).toBeInTheDocument();
    expect(mocks.requestPasswordReset).toHaveBeenCalledWith({ email: 'user@example.com' });

    await user.type(screen.getByLabelText('Código de segurança'), '123456');
    await user.click(screen.getByRole('button', { name: 'Validar código' }));
    expect(await screen.findByRole('heading', { name: 'Criar nova senha' })).toBeInTheDocument();
    expect(mocks.validateResetCode).toHaveBeenCalledWith({
      email: 'user@example.com',
      code: '123456',
    });

    await user.type(screen.getByLabelText('Nova senha'), 'new-password');
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'new-password');
    await user.click(screen.getByRole('button', { name: 'Atualizar senha' }));
    expect(mocks.resetPassword).toHaveBeenCalledWith('reset-token', {
      newPassword: 'new-password',
    });
  });
});
