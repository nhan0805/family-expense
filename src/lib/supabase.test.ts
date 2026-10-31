import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createFetchWithTimeout,
  SUPABASE_FUNCTION_REQUEST_TIMEOUT_MS,
  SUPABASE_REQUEST_TIMEOUT_MS,
} from './supabase';

describe('Supabase request budgets', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('keeps the AI Edge Function budget longer than normal Supabase requests', () => {
    expect(SUPABASE_FUNCTION_REQUEST_TIMEOUT_MS).toBeGreaterThan(SUPABASE_REQUEST_TIMEOUT_MS);
  });

  it('reports the configured timeout while preserving caller aborts', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new Error('aborted')),
            { once: true },
          );
        }),
      ),
    );

    const request = createFetchWithTimeout(SUPABASE_FUNCTION_REQUEST_TIMEOUT_MS)('https://example.test', {});
    const rejection = expect(request).rejects.toThrow('SUPABASE_REQUEST_TIMEOUT');
    await vi.advanceTimersByTimeAsync(SUPABASE_FUNCTION_REQUEST_TIMEOUT_MS);
    await rejection;
  });
});
