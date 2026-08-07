import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/components/auth/ThemeProvider';

const mocks = vi.hoisted(() => ({
  changePassword: vi.fn(),
  downloadFinancialReport: vi.fn(),
  getUserId: vi.fn(),
}));

vi.mock('@/services/userService', () => ({
  userService: { changePassword: mocks.changePassword },
}));
vi.mock('@/services/reportService', () => ({
  reportService: { downloadFinancialReport: mocks.downloadFinancialReport },
}));
vi.mock('@/services/authService', () => ({
  authService: { getUserId: mocks.getUserId },
}));

import { SettingsPage } from '@/pages/SettingsPage';

const renderPage = () => render(
  <ThemeProvider>
    <SettingsPage />
  </ThemeProvider>,
);

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserId.mockReturnValue('user-id');
    mocks.changePassword.mockResolvedValue({ message: 'Senha atualizada com sucesso.' });
    mocks.downloadFinancialReport.mockResolvedValue(undefined);
  });

  it('changes the authenticated user password', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Senha atual'), 'current-password');
    await user.type(screen.getByLabelText('Nova senha'), 'new-password');
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'new-password');
    await user.click(screen.getByRole('button', { name: /alterar senha/i }));

    expect(mocks.changePassword).toHaveBeenCalledWith({
      currentPassword: 'current-password',
      newPassword: 'new-password',
    });
    expect(await screen.findByText('Senha atualizada com sucesso.')).toBeInTheDocument();
  });

  it('downloads the financial CSV for the current user', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /baixar relatório csv/i }));

    expect(mocks.downloadFinancialReport).toHaveBeenCalledWith('user-id');
    expect(await screen.findByText(/arquivo csv foi preparado/i)).toBeInTheDocument();
  });
});
