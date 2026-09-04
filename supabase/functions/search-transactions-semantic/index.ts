import { createClient } from 'npm:@supabase/supabase-js@2.56.1';
import { z } from 'npm:zod@4.1.5';
import {
  generateTransactionEmbedding,
  TRANSACTION_EMBEDDING_MODEL,
  toPgVectorLiteral,
} from '../_shared/transactionEmbedding.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const requestSchema = z.object({
  familyId: z.string().uuid(),
  semanticQuery: z.string().trim().min(1).max(240),
  query: z.string().trim().max(240).default(''),
  page: z.number().int().min(0).max(10000).default(0),
  pageSize: z.number().int().min(1).max(100).default(50),
  transactionType: z.enum(['Chi tiêu', 'Thu nhập']).nullable().default(null),
  status: z.enum(['Thực tế', 'Dự kiến']).nullable().default(null),
  purposeIds: z.array(z.string().uuid()).max(20).default([]),
  expenseTypeIds: z.array(z.string().uuid()).max(20).default([]),
  paymentMethodIds: z.array(z.string().uuid()).max(20).default([]),
  amountMin: z.number().nonnegative().nullable().default(null),
  amountMax: z.number().nonnegative().nullable().default(null),
  month: z.number().int().min(1).max(12).nullable().default(null),
  year: z.number().int().min(2000).max(2200).nullable().default(null),
  dateFrom: isoDate.nullable().default(null),
  dateTo: isoDate.nullable().default(null),
  sort: z
    .enum([
      'date-desc',
      'date-asc',
      'amount-desc',
      'amount-asc',
      'description-asc',
    ])
    .default('date-desc'),
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  try {
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return json({ error: 'UNAUTHORIZED' }, 401);
    const parsed = requestSchema.parse(await req.json());
    if (
      (parsed.dateFrom && parsed.dateTo && parsed.dateFrom > parsed.dateTo) ||
      (parsed.amountMin !== null &&
        parsed.amountMax !== null &&
        parsed.amountMin > parsed.amountMax)
    )
      return json({ error: 'INVALID_FILTERS' }, 422);

    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    if (!url || !anon) return json({ error: 'SERVER_NOT_CONFIGURED' }, 500);
    const db = createClient(url, anon, {
      global: { headers: { Authorization: auth } },
    });
    const embedding = await generateTransactionEmbedding(parsed.semanticQuery);
    const { data, error } = await db.rpc('search_family_transactions_semantic', {
      p_family_id: parsed.familyId,
      p_query_embedding: toPgVectorLiteral(embedding),
      p_limit: parsed.pageSize,
      p_offset: parsed.page * parsed.pageSize,
      p_keyword: parsed.query,
      p_transaction_type: parsed.transactionType || '',
      p_status: parsed.status || '',
      p_purpose_ids: parsed.purposeIds,
      p_expense_type_ids: parsed.expenseTypeIds,
      p_payment_method_ids: parsed.paymentMethodIds,
      p_amount_min: parsed.amountMin,
      p_amount_max: parsed.amountMax,
      p_month: parsed.month,
      p_year: parsed.year,
      p_date_from: parsed.dateFrom,
      p_date_to: parsed.dateTo,
      p_sort: parsed.sort,
    });
    if (error) {
      if (error.message.includes('FORBIDDEN'))
        return json({ error: 'FORBIDDEN' }, 403);
      throw new Error('SEMANTIC_QUERY_FAILED');
    }
    return json({
      ...(data as object),
      embeddingModel: TRANSACTION_EMBEDDING_MODEL,
    });
  } catch (error) {
    if (error instanceof z.ZodError) return json({ error: 'INVALID_SCHEMA' }, 422);
    if (error instanceof Error && error.message === 'SEMANTIC_QUERY_FAILED')
      return json({ error: error.message }, 500);
    return json({ error: 'INTERNAL_ERROR' }, 500);
  }
});
