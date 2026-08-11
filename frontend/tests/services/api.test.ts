import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AxiosInstance } from 'axios';

const mockedGet = vi.fn();
const mockedPost = vi.fn();
const requestInterceptors: Array<(config: unknown) => unknown> = [];
const responseInterceptors: Array<(error: unknown) => unknown> = [];

vi.mock('axios', async (importOriginal) => {
  const actual = (await importOriginal()) as { default: { create: (...args: unknown[]) => AxiosInstance } };
  return {
    ...actual,
    default: {
      ...actual.default,
      create: vi.fn(() => ({
        defaults: { baseURL: '/api/v1' },
        get: mockedGet,
        post: mockedPost,
        interceptors: {
          request: {
            use: (onFulfilled: (config: unknown) => unknown) => {
              requestInterceptors.push(onFulfilled);
            },
          },
          response: {
            use: (_onFulfilled: unknown, onRejected: (error: unknown) => unknown) => {
              responseInterceptors.push(onRejected);
            },
          },
        },
      })) as unknown as (...args: unknown[]) => AxiosInstance,
    },
  };
});

describe('api client', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    requestInterceptors.length = 0;
    responseInterceptors.length = 0;
    localStorage.clear();
    await import('@/lib/api');
  });

  afterEach(() => {
    requestInterceptors.length = 0;
    responseInterceptors.length = 0;
  });

  it('sends Authorization header when token exists', () => {
    localStorage.setItem('finance_ai_token', 'test-token');
    const config = { headers: {} };
    const interceptor = requestInterceptors[0];
    expect(interceptor).toBeDefined();
    const result = interceptor(config);
    expect((result as { headers: { Authorization: string } }).headers.Authorization).toBe('Bearer test-token');
  });

  it('clears token and rejects on 401', async () => {
    localStorage.setItem('finance_ai_token', 'test-token');
    const error = {
      response: { status: 401, data: { message: 'Unauthorized' } },
      message: 'Request failed',
    };

    const interceptor = responseInterceptors[0];
    expect(interceptor).toBeDefined();
    await expect(interceptor(error)).rejects.toBeDefined();
    expect(localStorage.getItem('finance_ai_token')).toBeNull();
  });

  it('does not reload the login page when the login request is rejected', async () => {
    window.location.href = '';
    const error = {
      config: { url: '/auth/login' },
      response: { status: 401, data: { message: 'Credenciais inválidas' } },
      message: 'Request failed',
    };

    const interceptor = responseInterceptors[0];
    await expect(interceptor(error)).rejects.toBeDefined();
    expect(window.location.href).toBe('');
  });

  it('extracts the message from a normalized API error', async () => {
    const { extractErrorMessage } = await import('@/lib/api');

    expect(extractErrorMessage({ message: 'Credenciais inválidas', status: 401 })).toBe(
      'Credenciais inválidas'
    );
  });
});
