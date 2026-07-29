import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockedPost = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  api: {
    post: mockedPost,
  },
}));

import { authService, TOKEN_KEY } from '@/services/authService';

describe('authService', () => {
  beforeEach(() => {
    mockedPost.mockReset();
    localStorage.clear();
  });

  it('uses the backend login contract and stores the returned token', async () => {
    mockedPost.mockResolvedValue({
      data: {
        success: true,
        data: {
          token: 'jwt-token',
          type: 'Bearer',
          userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          email: 'demo@financeai.com',
          expiresInMs: 86400000,
        },
        message: null,
        timestamp: '2026-07-15T19:00:00Z',
      },
    });

    const response = await authService.login({
      email: 'demo@financeai.com',
      password: 'demo123',
    });

    expect(mockedPost).toHaveBeenCalledWith('/auth/login', {
      email: 'demo@financeai.com',
      password: 'demo123',
    });
    expect(response.token).toBe('jwt-token');
    expect(localStorage.getItem(TOKEN_KEY)).toBe('jwt-token');
  });

  it('rejects an invalid success envelope without storing a token', async () => {
    mockedPost.mockResolvedValue({
      data: {
        success: false,
        data: null,
        message: 'Credenciais inválidas',
        timestamp: '2026-07-15T19:00:00Z',
      },
    });

    await expect(
      authService.login({ email: 'demo@financeai.com', password: 'incorreta' })
    ).rejects.toThrow('Credenciais inválidas');
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('uses the backend register contract without storing a session', async () => {
    mockedPost.mockResolvedValue({
      data: {
        success: true,
        data: {
          email: 'novo@financeai.com',
          isEmailVerified: false,
          createdAt: '2026-07-23T20:00:00Z',
        },
        message: null,
        timestamp: '2026-07-23T20:00:00Z',
      },
    });

    const response = await authService.register({
      fullName: 'Novo Usuario',
      email: 'novo@financeai.com',
      password: '12345678',
    });

    expect(mockedPost).toHaveBeenCalledWith('/auth/register', {
      fullName: 'Novo Usuario',
      email: 'novo@financeai.com',
      password: '12345678',
    });
    expect(response.email).toBe('novo@financeai.com');
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});
