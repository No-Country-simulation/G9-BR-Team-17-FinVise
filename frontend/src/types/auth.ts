export interface AuthRequest {
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ValidateResetCodeRequest {
  email: string;
  code: string;
}

export interface ResetPasswordRequest {
  newPassword: string;
}

export interface GenericMessageResponse {
  message: string;
}

export interface ValidateResetCodeResponse {
  resetToken: string;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  type: string;
  userId: string;
  email: string;
  expiresInMs: number;
}

export interface RegisterResponse {
  email: string;
  isEmailVerified: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  fullName?: string;
}
