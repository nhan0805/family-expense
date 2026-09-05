import { normalizeText } from './domain';
import { supabase } from './supabase';

export const AI_REQUEST_TIMEOUT_MS = 25_000;
export const AI_SEARCH_CACHE_STALE_TIME_MS = 5 * 60_000;
export const AI_SEARCH_CACHE_GC_TIME_MS = 30 * 60_000;

export const getAiSearchCacheKey = (
  familyId: string,
  language: 'vi' | 'en',
  text: string,
  catalogVersion: string,
) => [
  'ai-transaction-search',
  familyId,
  language,
  catalogVersion,
  normalizeText(text),
] as const;

export class AiRequestTimeoutError extends Error {
  constructor() {
    super('AI_TIMEOUT');
    this.name = 'AiRequestTimeoutError';
  }
}

const errorStatus = (error: unknown) =>
  (error as { context?: { status?: number } } | null)?.context?.status;

export const isAiRateLimited = (error: unknown) => {
  if (
    error instanceof Error &&
    /429|rate.?limited|rate limit/i.test(error.message)
  )
    return true;
  return errorStatus(error) === 429;
};

export const aiErrorMessage = (
  error: unknown,
  en: boolean,
  feature: 'parse' | 'search' | 'summary',
) => {
  if (
    error instanceof AiRequestTimeoutError ||
    errorStatus(error) === 504 ||
    (error instanceof Error && /AI_TIMEOUT|GEMINI_TIMEOUT/.test(error.message))
  )
    return en
      ? 'AI took too long to respond. Please try again.'
      : 'AI phản hồi quá lâu. Vui lòng thử lại.';
  if (isAiRateLimited(error))
    return en
      ? 'AI usage is currently limited. Please try again later.'
      : 'AI đang đạt giới hạn sử dụng. Vui lòng thử lại sau.';
  if (feature === 'parse')
    return en
      ? 'Could not analyze this now. Please try again.'
      : 'Không thể phân tích lúc này. Vui lòng thử lại.';
  if (feature === 'search')
    return en
      ? 'AI search is temporarily unavailable. Please try again.'
      : 'Tìm kiếm AI tạm thời chưa khả dụng. Vui lòng thử lại.';
  return en
    ? 'AI summary is temporarily unavailable. Please try again.'
    : 'Chưa thể tạo tóm tắt AI. Vui lòng thử lại.';
};

export async function invokeAiFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, AI_REQUEST_TIMEOUT_MS);
  const abortCaller = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', abortCaller, { once: true });
  }

  try {
    const { data, error } = await supabase.functions.invoke<T>(functionName, {
      body,
      signal: controller.signal,
    });
    if (timedOut) throw new AiRequestTimeoutError();
    if (error) throw error;
    return data as T;
  } catch (error) {
    if (timedOut) throw new AiRequestTimeoutError();
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortCaller);
  }
}
