import { createClient } from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL as string|undefined; const key=import.meta.env.VITE_SUPABASE_ANON_KEY as string|undefined;
export const isSupabaseConfigured=Boolean(url&&key&&!url.includes('your-project'));

export const SUPABASE_REQUEST_TIMEOUT_MS = 15_000;
export const SUPABASE_FUNCTION_REQUEST_TIMEOUT_MS = 30_000;

export const createFetchWithTimeout = (timeoutMs: number): typeof fetch => async (input, init) => {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abortFromCaller = () => controller.abort();
  init?.signal?.addEventListener('abort', abortFromCaller, { once: true });
  if (init?.signal?.aborted) controller.abort();

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) throw new Error('SUPABASE_REQUEST_TIMEOUT');
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
    init?.signal?.removeEventListener('abort', abortFromCaller);
  }
};

const fetchWithTimeout = createFetchWithTimeout(SUPABASE_REQUEST_TIMEOUT_MS);
const fetchForAiFunctions = createFetchWithTimeout(SUPABASE_FUNCTION_REQUEST_TIMEOUT_MS);
const supabaseUrl = url || 'https://placeholder.supabase.co';
const supabaseKey = key || 'placeholder';

export const supabase=createClient(supabaseUrl,supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},global:{fetch: fetchWithTimeout}});

// AI Edge Functions may spend up to 25 seconds waiting for Gemini. Keep the
// normal Supabase request budget for CRUD/RPC calls, but give AI its own
// client and fetch budget. The access token still comes from the primary auth
// client, so RLS and function JWT verification remain unchanged.
export const supabaseAi = createClient(supabaseUrl, supabaseKey, {
  accessToken: async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  },
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: fetchForAiFunctions },
});
