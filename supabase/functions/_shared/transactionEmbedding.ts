import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

export const TRANSACTION_EMBEDDING_MODEL = 'gte-small';

// Keep one inference session for the lifetime of the Edge Function isolate.
// Recreating it for every transaction needlessly multiplies CPU and memory use.
const transactionEmbeddingSession = new Supabase.ai.Session(
  TRANSACTION_EMBEDDING_MODEL,
);

export const buildTransactionSearchText = (
  description: string,
  note: string | null,
) => [description.trim(), note?.trim() || ''].filter(Boolean).join('\n');

export const toPgVectorLiteral = (embedding: number[]) =>
  `[${embedding.join(',')}]`;

export async function generateTransactionEmbedding(text: string) {
  const output = await transactionEmbeddingSession.run(text, {
    mean_pool: true,
    normalize: true,
  });
  return Array.from(output.data as ArrayLike<number>, Number);
}
