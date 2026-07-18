export interface AuthRequest {
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

export interface User {
  id: string;
  username: string;
  email?: string;
  fullName?: string;
}
