import { createClient } from 'npm:@supabase/supabase-js@2.56.1';
import { z } from 'npm:zod@4.1.5';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const requestSchema = z.object({
  familyId: z.string().uuid(),
});

type Relation = { name?: string } | Array<{ name?: string }> | null;
type TransactionRow = {
  transaction_date: string;
  transaction_type: string;
  status: string;
  description: string;
  amount: number | string;
  note: string | null;
  source: string;
  purpose: Relation;
  expense_type: Relation;
  payment_method: Relation;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

const relationName = (value: Relation) => {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation?.name || '';
};

const csvCell = (value: unknown) => {
  const text = value == null ? '' : String(value);
  return /["\n,\r]/.test(text)
    ? `"${text.replaceAll('"', '""')}"`
    : text;
};

const transactionTypeLabel = (type: string) =>
  type === 'Chi tiêu' ? 'Tiền ra' : type === 'Thu nhập' ? 'Tiền vào' : type;

const toCsv = (rows: TransactionRow[]) => {
  const headers = [
    'Ngày',
    'Loại giao dịch',
    'Trạng thái',
    'Nội dung',
    'Số tiền',
    'Mục đích',
    'Danh mục',
    'Phương thức thanh toán',
    'Ghi chú',
    'Nguồn',
  ];
  const values = rows.map((row) => [
    row.transaction_date,
    transactionTypeLabel(row.transaction_type),
    row.status,
    row.description,
    Number(row.amount),
    relationName(row.purpose),
    relationName(row.expense_type),
    relationName(row.payment_method),
    row.note || '',
    row.source,
  ]);
  return `\uFEFF${[headers, ...values]
    .map((line) => line.map(csvCell).join(','))
    .join('\r\n')}`;
};

const toBase64 = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)),
    );
  }
  return btoa(binary);
};

const getAccessToken = (auth: string) => auth.slice('Bearer '.length);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  try {
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return json({ error: 'UNAUTHORIZED' }, 401);

    const apiKey = Deno.env.get('BREVO_API_KEY');
    const senderEmail = Deno.env.get('BREVO_SENDER_EMAIL');
    const senderName = Deno.env.get('BREVO_SENDER_NAME') || 'Family Expense';
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    if (!apiKey || !senderEmail || !url || !anon)
      return json({ error: 'SERVER_NOT_CONFIGURED' }, 500);

    const { familyId } = requestSchema.parse(await req.json());
    const db = createClient(url, anon, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userError } = await db.auth.getUser(
      getAccessToken(auth),
    );
    if (userError || !userData.user?.email)
      return json({ error: 'UNAUTHORIZED' }, 401);

    const { data: membership, error: membershipError } = await db
      .from('family_members')
      .select('role')
      .eq('family_id', familyId)
      .eq('user_id', userData.user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (membershipError) return json({ error: 'MEMBERSHIP_QUERY_FAILED' }, 500);
    if (!membership) return json({ error: 'FORBIDDEN' }, 403);
    if (membership.role !== 'owner') return json({ error: 'OWNER_REQUIRED' }, 403);

    const allRows: TransactionRow[] = [];
    const batchSize = 500;
    for (let from = 0; ; from += batchSize) {
      const { data, error } = await db
        .from('transactions')
        .select(
          'transaction_date,transaction_type,status,description,amount,note,source,purpose:purposes!transactions_purpose_same_family_fkey(name),expense_type:expense_types!transactions_expense_type_same_family_fkey(name),payment_method:payment_methods!transactions_payment_method_same_family_fkey(name)',
        )
        .eq('family_id', familyId)
        .is('deleted_at', null)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, from + batchSize - 1);
      if (error) return json({ error: 'TRANSACTION_QUERY_FAILED' }, 500);
      const batch = (data || []) as TransactionRow[];
      allRows.push(...batch);
      if (batch.length < batchSize) break;
    }
    if (!allRows.length) return json({ error: 'NO_TRANSACTIONS' }, 422);

    const csv = toCsv(allRows);
    const base64File = toBase64(csv);
    if (base64File.length > 18_000_000)
      return json({ error: 'FILE_TOO_LARGE' }, 413);
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(new Date());
    const recipient = userData.user.email;
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: recipient }],
        subject: `Danh sách giao dịch gia đình - ${today}`,
        htmlContent:
          '<p>Danh sách toàn bộ giao dịch đang hoạt động của gia đình được đính kèm dưới dạng CSV.</p>',
        textContent:
          'Danh sách toàn bộ giao dịch đang hoạt động của gia đình được đính kèm dưới dạng CSV.',
        attachment: [
          {
            name: `family-expense-${today}.csv`,
            content: base64File,
          },
        ],
      }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      console.error('BREVO_SEND_FAILED', JSON.stringify({ status: response.status }));
      if (response.status === 429) return json({ error: 'RATE_LIMITED' }, 429);
      return json({ error: 'EMAIL_PROVIDER_FAILED' }, 502);
    }

    return json({ sent: true, transactionCount: allRows.length });
  } catch (error) {
    if (error instanceof z.ZodError)
      return json({ error: 'INVALID_SCHEMA' }, 422);
    console.error(
      'EMAIL_TRANSACTIONS_FAILED',
      JSON.stringify({ code: error instanceof Error ? error.message : 'UNKNOWN' }),
    );
    return json({ error: 'INTERNAL_ERROR' }, 500);
  }
});
