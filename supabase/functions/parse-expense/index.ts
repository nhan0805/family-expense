import { createClient } from 'npm:@supabase/supabase-js@2.56.1';
import { z } from 'npm:zod@4.1.5';

declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const requestSchema = z.object({
  text: z.string().trim().min(3).max(1000),
  familyId: z.string().uuid(),
  timezone: z.literal('Asia/Ho_Chi_Minh').default('Asia/Ho_Chi_Minh'),
});
const suggestionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1),
  amount: z.number().positive().nullable(),
  transactionType: z.enum(['Chi tiêu', 'Thu nhập']),
  status: z.enum(['Thực tế', 'Dự kiến']),
  purposeId: z.string().uuid().nullable(),
  purposeName: z.string().nullable(),
  expenseTypeId: z.string().uuid().nullable(),
  expenseTypeName: z.string().nullable(),
  paymentMethodId: z.string().uuid().nullable(),
  paymentMethodName: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()),
});
const responseSchema = {
  type: 'object',
  properties: {
    date: { type: 'string' },
    description: { type: 'string' },
    amount: { type: ['number', 'null'] },
    transactionType: {
      type: 'string',
      enum: ['Chi tiêu', 'Thu nhập'],
    },
    status: { type: 'string', enum: ['Thực tế', 'Dự kiến'] },
    purposeId: { type: ['string', 'null'] },
    purposeName: { type: ['string', 'null'] },
    expenseTypeId: { type: ['string', 'null'] },
    expenseTypeName: { type: ['string', 'null'] },
    paymentMethodId: { type: ['string', 'null'] },
    paymentMethodName: { type: ['string', 'null'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'date',
    'description',
    'amount',
    'transactionType',
    'status',
    'purposeId',
    'purposeName',
    'expenseTypeId',
    'expenseTypeName',
    'paymentMethodId',
    'paymentMethodName',
    'confidence',
    'warnings',
  ],
  additionalProperties: false,
};
type CatalogItem = { id: string; name: string };
type Catalog = {
  userId: string;
  purposes: CatalogItem[];
  expenseTypes: CatalogItem[];
  paymentMethods: CatalogItem[];
};
type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  const started = Date.now();
  let contextMs = 0;
  let geminiMs = 0;
  let familyId = '';
  let userId = '';
  const model = Deno.env.get('GEMINI_MODEL') || '';
  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY'),
      url = Deno.env.get('SUPABASE_URL'),
      anon = Deno.env.get('SUPABASE_ANON_KEY');
    if (!apiKey || !model || !url || !anon)
      throw new Error('SERVER_NOT_CONFIGURED');
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer '))
      return json({ error: 'UNAUTHORIZED' }, 401);
    const db = createClient(url, anon, {
      global: { headers: { Authorization: auth } },
    });
    const parsed = requestSchema.parse(await req.json());
    familyId = parsed.familyId;
    const contextStarted = Date.now();
    const { data: context, error: contextError } = await db.rpc(
      'get_ai_request_context',
      { p_family_id: familyId },
    );
    contextMs = Date.now() - contextStarted;
    if (contextError) {
      if (contextError.message.includes('FORBIDDEN'))
        return json({ error: 'FORBIDDEN' }, 403);
      if (contextError.message.includes('RATE_LIMITED'))
        return json({ error: 'RATE_LIMITED' }, 429);
      throw new Error('CATALOG_QUERY_FAILED');
    }
    userId = (context as Catalog).userId;
    if (!userId) throw new Error('INVALID_AUTH_CONTEXT');
    const now = new Intl.DateTimeFormat('en-CA', {
      timeZone: parsed.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const catalog = context as Catalog;
    const catalogForPrompt = {
      purposes: catalog.purposes,
      expenseTypes: catalog.expenseTypes,
      paymentMethods: catalog.paymentMethods,
    };
    const prompt = `Trích xuất đúng MỘT giao dịch từ câu tiếng Việt. Hôm nay ${now}, múi giờ ${parsed.timezone}. Chỉ dùng ID/tên trong danh mục: ${JSON.stringify(catalogForPrompt)}. Chỉ chọn transactionType là Chi tiêu (tiền ra) hoặc Thu nhập (tiền vào); không tạo loại khác. amount luôn dương; nghìn/ngàn/k=1000; triệu=1000000; "một triệu hai"=1200000. Ngày tương lai=>Dự kiến. Thiếu ngày dùng ${now} và cảnh báo; thiếu tiền dùng null và cảnh báo. Không chắc thì null hoặc danh mục Khác có sẵn; không bịa. Nội dung: ${parsed.text}`;
    const geminiStarted = Date.now();
    const aiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            thinkingConfig: { thinkingLevel: 'MINIMAL' },
            responseMimeType: 'application/json',
            responseJsonSchema: responseSchema,
            maxOutputTokens: 512,
            candidateCount: 1,
          },
        }),
      },
    );
    geminiMs = Date.now() - geminiStarted;
    if (!aiResponse.ok) {
      await aiResponse.body?.cancel();
      console.error('GEMINI_REQUEST_FAILED', JSON.stringify({ status: aiResponse.status, model, latencyMs: geminiMs }));
      if (aiResponse.status === 429) throw new Error('RATE_LIMITED');
      throw new Error(`GEMINI_${aiResponse.status}`);
    }
    const aiPayload = (await aiResponse.json()) as GeminiResponse;
    const responseText = aiPayload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .join('');
    if (!responseText) throw new Error('EMPTY_AI_RESPONSE');
    const suggestion = suggestionSchema.parse(JSON.parse(responseText));
    const ids = {
      purposes: new Set(catalog.purposes.map((x) => x.id)),
      expenseTypes: new Set(catalog.expenseTypes.map((x) => x.id)),
      paymentMethods: new Set(catalog.paymentMethods.map((x) => x.id)),
    };
    if (suggestion.purposeId && !ids.purposes.has(suggestion.purposeId))
      throw new Error('UNKNOWN_PURPOSE');
    if (
      suggestion.expenseTypeId &&
      !ids.expenseTypes.has(suggestion.expenseTypeId)
    )
      throw new Error('UNKNOWN_EXPENSE_TYPE');
    if (
      suggestion.paymentMethodId &&
      !ids.paymentMethods.has(suggestion.paymentMethodId)
    )
      throw new Error('UNKNOWN_PAYMENT_METHOD');
    const logStarted = Date.now() - started;
    console.log(
      'AI_TIMING',
      JSON.stringify({
        contextMs,
        geminiMs,
        totalMs: logStarted,
        model,
        region: Deno.env.get('SB_REGION') || 'unknown',
      }),
    );
    EdgeRuntime.waitUntil(
      db
        .from('ai_usage_logs')
        .insert({
          family_id: familyId,
          user_id: userId,
          request_date: now,
          model,
          status: 'success',
          latency_ms: logStarted,
          input_length: parsed.text.length,
        })
        .then(({ error: logError }) => {
          if (logError) console.error('AI_USAGE_LOG_FAILED', logError.message);
        }),
    );
    return json({ suggestion });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN';
    if (familyId && userId) {
      try {
        const url = Deno.env.get('SUPABASE_URL')!,
          anon = Deno.env.get('SUPABASE_ANON_KEY')!,
          auth = req.headers.get('Authorization')!;
        await createClient(url, anon, {
          global: { headers: { Authorization: auth } },
        })
          .from('ai_usage_logs')
          .insert({
            family_id: familyId,
            user_id: userId,
            request_date: new Date().toISOString().slice(0, 10),
            model: model || 'unset',
            status: 'error',
            latency_ms: Date.now() - started,
            input_length: 0,
            error_code: code.slice(0, 80),
          });
      } catch {
        /* Không làm lộ lỗi log */
      }
    }
    if (code.includes('429') || code === 'RATE_LIMITED')
      return json({ error: 'RATE_LIMITED' }, 429);
    if (error instanceof z.ZodError)
      return json(
        {
          error: 'INVALID_SCHEMA',
          details: error.issues.map((i) => i.message),
        },
        422,
      );
    return json({ error: code }, 500);
  }
});
