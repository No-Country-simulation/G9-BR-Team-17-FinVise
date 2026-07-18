import { api } from '@/lib/api';
import { AuthRequest, AuthResponse } from '@/types/auth';
import { ApiResponse } from '@/types/common';

export const TOKEN_KEY = 'finance_ai_token';
export const USER_ID_KEY = 'finance_ai_user_id';

export const authService = {
  async login(request: AuthRequest): Promise<AuthResponse> {
    const { data: response } = await api.post<ApiResponse<AuthResponse>>('/auth/login', request);

    if (!response.success || !response.data?.token) {
      throw new Error(response.message || 'Resposta de autenticação inválida');
    }

    localStorage.setItem(TOKEN_KEY, response.data.token);
    localStorage.setItem(USER_ID_KEY, response.data.userId);
    return response.data;
  },

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_ID_KEY);
  },

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  getUserId(): string | null {
    return localStorage.getItem(USER_ID_KEY);
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem(TOKEN_KEY);
  },
};
