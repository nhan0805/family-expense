const baseHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  Vary: 'Origin',
};

const defaultOrigins = new Set([
  'https://fafin.pages.dev',
  'https://family-expense-8fo.pages.dev',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

const configuredOrigins = () => {
  const value = Deno.env.get('CORS_ALLOWED_ORIGINS');
  if (!value) return defaultOrigins;
  return new Set(value.split(',').map((origin) => origin.trim()).filter(Boolean));
};

const isAllowedOrigin = (origin: string) => {
  const allowed = configuredOrigins();
  if (allowed.has(origin)) return true;
  if (Deno.env.get('CORS_ALLOWED_ORIGINS')) return false;
  try {
    const url = new URL(origin);
    return url.protocol === 'https:' && url.hostname.endsWith('.family-expense-8fo.pages.dev');
  } catch {
    return false;
  }
};

export const corsHeaders = (request: Request): HeadersInit => {
  const headers: Record<string, string> = { ...baseHeaders };
  const origin = request.headers.get('Origin');
  if (origin && isAllowedOrigin(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
};

export const optionsResponse = (request: Request) =>
  new Response(null, { status: 204, headers: corsHeaders(request) });

export const jsonResponse = (request: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
  });

export const parseJsonBody = async (request: Request) => {
  try {
    return await request.json();
  } catch {
    throw new Error('INVALID_REQUEST_BODY');
  }
};
