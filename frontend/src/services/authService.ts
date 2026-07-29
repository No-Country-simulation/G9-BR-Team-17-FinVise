import { api } from '@/lib/api';
import {
  AuthRequest,
  AuthResponse,
  ForgotPasswordRequest,
  GenericMessageResponse,
  RegisterRequest,
  RegisterResponse,
  ResetPasswordRequest,
  ValidateResetCodeRequest,
  ValidateResetCodeResponse,
} from '@/types/auth';
import { ApiResponse } from '@/types/common';

export const TOKEN_KEY = 'finance_ai_token';
export const USER_ID_KEY = 'finance_ai_user_id';

function storeSession(response: AuthResponse) {
  localStorage.setItem(TOKEN_KEY, response.token);
  localStorage.setItem(USER_ID_KEY, response.userId);
}

export const authService = {
  async login(request: AuthRequest): Promise<AuthResponse> {
    const { data: response } = await api.post<ApiResponse<AuthResponse>>('/auth/login', request);

    if (!response.success || !response.data?.token) {
      throw new Error(response.message || 'Resposta de autenticação inválida');
    }

    storeSession(response.data);
    return response.data;
  },

  async register(request: RegisterRequest): Promise<RegisterResponse> {
    const { data: response } = await api.post<ApiResponse<RegisterResponse>>('/auth/register', request);

    if (!response.success || !response.data?.email) {
      throw new Error(response.message || 'Resposta de cadastro inválida');
    }

    return response.data;
  },

  async requestPasswordReset(request: ForgotPasswordRequest): Promise<GenericMessageResponse> {
    const { data } = await api.post<GenericMessageResponse>('/auth/forgot-password', request);

    if (!data?.message) {
      throw new Error('Resposta de recuperação de senha inválida');
    }

    return data;
  },

  async validateResetCode(request: ValidateResetCodeRequest): Promise<ValidateResetCodeResponse> {
    const { data } = await api.post<ValidateResetCodeResponse>('/auth/validate-reset-code', request);

    if (!data?.resetToken) {
      throw new Error('Resposta de validação inválida');
    }

    return data;
  },

  async resetPassword(resetToken: string, request: ResetPasswordRequest): Promise<GenericMessageResponse> {
    const { data } = await api.post<GenericMessageResponse>(
      '/auth/reset-password',
      request,
      {
        headers: {
          Authorization: `Bearer ${resetToken}`,
        },
      }
    );

    if (!data?.message) {
      throw new Error('Resposta de redefinição inválida');
    }

    return data;
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
