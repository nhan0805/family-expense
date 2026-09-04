import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AI_REQUEST_TIMEOUT_MS,
  AI_SEARCH_CACHE_GC_TIME_MS,
  AI_SEARCH_CACHE_STALE_TIME_MS,
  AiRequestTimeoutError,
  aiErrorMessage,
  getAiSearchCacheKey,
  invokeAiFunction,
} from './aiClient';
const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock('./supabase', () => ({
  supabase: { functions: { invoke: invokeMock } },
}));

describe('aiClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    invokeMock.mockReset();
    vi.useRealTimers();
  });

  it('keeps AI requests within the user-facing timeout budget', () => {
    expect(AI_REQUEST_TIMEOUT_MS).toBeGreaterThanOrEqual(20_000);
    expect(AI_REQUEST_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
  });

  it('reuses the same cache key for equivalent AI search text', () => {
    expect(getAiSearchCacheKey('family-1', 'vi', ' Mua quần áo! ', 'catalog-1')).toEqual(
      getAiSearchCacheKey('family-1', 'vi', 'mua quan ao', 'catalog-1'),
    );
    expect(AI_SEARCH_CACHE_STALE_TIME_MS).toBe(5 * 60_000);
    expect(AI_SEARCH_CACHE_GC_TIME_MS).toBe(30 * 60_000);
  });

  it('converts an aborted request caused by the timeout into a typed error', async () => {
    vi.useFakeTimers();
    invokeMock.mockImplementation(
      (_name, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener(
            'abort',
            () => reject(new Error('aborted')),
            { once: true },
          );
        }),
    );

    const request = invokeAiFunction('summary', {});
    const rejection = expect(request).rejects.toBeInstanceOf(
      AiRequestTimeoutError,
    );
    await vi.advanceTimersByTimeAsync(AI_REQUEST_TIMEOUT_MS);
    await rejection;
  });

  it('explains retryable AI errors in both supported languages', () => {
    expect(
      aiErrorMessage(new AiRequestTimeoutError(), false, 'summary'),
    ).toContain('quá lâu');
    expect(
      aiErrorMessage(new Error('429 RATE_LIMITED'), true, 'search'),
    ).toContain('limited');
    expect(
      aiErrorMessage({ context: { status: 504 } }, false, 'parse'),
    ).toContain('quá lâu');
  });
});
