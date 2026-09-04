import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

export const TRANSACTION_EMBEDDING_MODEL = 'gte-small';

export const buildTransactionSearchText = (
  description: string,
  note: string | null,
) => [description.trim(), note?.trim() || ''].filter(Boolean).join('\n');

export const toPgVectorLiteral = (embedding: number[]) =>
  `[${embedding.join(',')}]`;

export async function generateTransactionEmbedding(text: string) {
  const session = new Supabase.ai.Session(TRANSACTION_EMBEDDING_MODEL);
  const output = await session.run(text, {
    mean_pool: true,
    normalize: true,
  });
  return Array.from(output.data as ArrayLike<number>, Number);
}
