import { createClient } from 'npm:@supabase/supabase-js@2.56.1';
import { z } from 'npm:zod@4.1.5';
import {
  buildTransactionSearchText,
  generateTransactionEmbedding,
  TRANSACTION_EMBEDDING_MODEL,
} from '../_shared/transactionEmbedding.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const requestSchema = z.object({
  familyId: z.string().uuid(),
  transactionIds: z.array(z.string().uuid()).max(100).default([]),
  limit: z.number().int().min(1).max(100).default(20),
});
type EmbeddingRow = {
  id: string;
  family_id: string;
  description: string;
  note: string | null;
  source_hash: string;
};
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
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    if (!url || !anon) return json({ error: 'SERVER_NOT_CONFIGURED' }, 500);
    const db = createClient(url, anon, {
      global: { headers: { Authorization: auth } },
    });
    const { data: rows, error: rowsError } = await db.rpc(
      'get_transaction_embedding_batch',
      {
        p_family_id: parsed.familyId,
        p_transaction_ids: parsed.transactionIds.length
          ? parsed.transactionIds
          : null,
        p_limit: parsed.limit,
      },
    );
    if (rowsError) {
      if (rowsError.message.includes('FORBIDDEN'))
        return json({ error: 'FORBIDDEN' }, 403);
      throw new Error('EMBEDDING_BATCH_FAILED');
    }

    let processed = 0;
    let failed = 0;
    for (const row of (rows || []) as EmbeddingRow[]) {
      try {
        const embedding = await generateTransactionEmbedding(
          buildTransactionSearchText(row.description, row.note),
        );
        const { error } = await db.rpc('upsert_transaction_embedding', {
          p_family_id: row.family_id,
          p_transaction_id: row.id,
          p_embedding: embedding,
          p_model: TRANSACTION_EMBEDDING_MODEL,
          p_source_hash: row.source_hash,
        });
        if (error) throw new Error('EMBEDDING_WRITE_FAILED');
        processed += 1;
      } catch {
        failed += 1;
      }
    }
    return json({
      processed,
      failed,
      remainingHint: rows?.length === parsed.limit,
    });
  } catch (error) {
    if (error instanceof z.ZodError) return json({ error: 'INVALID_SCHEMA' }, 422);
    if (error instanceof Error && error.message === 'EMBEDDING_BATCH_FAILED')
      return json({ error: error.message }, 500);
    return json({ error: 'INTERNAL_ERROR' }, 500);
  }
});
