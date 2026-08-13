import { afterEach, describe, expect, it, vi } from 'vitest';

import { generateUUID } from '@/lib/utils';

describe('generateUUID', () => {
  const originalCrypto = globalThis.crypto;

  afterEach(() => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: originalCrypto,
    });
    vi.restoreAllMocks();
  });

  it('uses crypto.randomUUID when the browser provides it', () => {
    const randomUUID = vi.fn(() => '123e4567-e89b-42d3-a456-426614174000' as `${string}-${string}-${string}-${string}-${string}`);
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID },
    });

    expect(generateUUID()).toBe('123e4567-e89b-42d3-a456-426614174000');
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it('generates a UUID v4 when randomUUID is unavailable', () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {},
    });
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    expect(generateUUID()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
