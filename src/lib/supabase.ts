import { createClient } from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL as string|undefined; const key=import.meta.env.VITE_SUPABASE_ANON_KEY as string|undefined;
export const isSupabaseConfigured=Boolean(url&&key&&!url.includes('your-project'));

export const SUPABASE_REQUEST_TIMEOUT_MS = 15_000;

const fetchWithTimeout: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, SUPABASE_REQUEST_TIMEOUT_MS);
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

export const supabase=createClient(url||'https://placeholder.supabase.co',key||'placeholder',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},global:{fetch: fetchWithTimeout}});
