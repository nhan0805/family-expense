import type { Transaction } from './domain';
import { supabase } from './supabase';

export type ServerTransactionFilters = {
  query: string;
  semanticQuery: string;
  transactionType: string;
  status: string;
  purposeIds: string[];
  expenseTypeIds: string[];
  paymentMethodIds: string[];
  amountMin: string;
  amountMax: string;
  month: string;
  year: string;
  dateFrom: string;
  dateTo: string;
  sort: string;
};

type TransactionRow = {
  id: string;
  family_id: string;
  transaction_date: string;
  transaction_type: Transaction['transactionType'];
  status: Transaction['status'];
  description: string;
  amount: number | string;
  purpose_id: string;
  expense_type_id: string;
  beneficiary_id: string | null;
  payment_method_id: string | null;
  note: string | null;
  source: Transaction['source'];
  source_reference: string | null;
  ai_generated: boolean;
  recurring_transaction_id?: string | null;
  created_by: string;
  created_at: string;
  deleted_at: string | null;
};

export const mapTransactionRow = (row: TransactionRow): Transaction => ({
  id: row.id,
  familyId: row.family_id,
  transactionDate: row.transaction_date,
  transactionType: row.transaction_type,
  status: row.status,
  description: row.description,
  amount: Number(row.amount),
  purposeId: row.purpose_id,
  expenseTypeId: row.expense_type_id,
  beneficiaryId: row.beneficiary_id,
  paymentMethodId: row.payment_method_id,
  note: row.note,
  source: row.source,
  sourceReference: row.source_reference,
  aiGenerated: row.ai_generated,
  createdBy: row.created_by,
  createdAt: row.created_at,
  deletedAt: row.deleted_at,
  recurringTransactionId: row.recurring_transaction_id || null,
});

export async function fetchTransactionPage(
  familyId: string,
  filters: ServerTransactionFilters,
  page: number,
  pageSize = 50,
) {
  if (filters.semanticQuery) {
    // Backfill is best-effort. A resource-limited embedding batch must not
    // hide otherwise valid structural/keyword results from the user.
    try {
      await supabase.functions.invoke(
        'process-transaction-embeddings',
        {
          body: {
            familyId,
            limit: 5,
          },
        },
      );
    } catch {
      // The semantic query below can still return filtered rows without a
      // completed lazy backfill.
    }
    const { data, error } = await supabase.functions.invoke<unknown>(
      'search-transactions-semantic',
      {
        body: {
          familyId,
          semanticQuery: filters.semanticQuery,
          page,
          pageSize,
          query: filters.query || filters.semanticQuery,
          transactionType: filters.transactionType || null,
          status: filters.status || null,
          purposeIds: filters.purposeIds,
          expenseTypeIds: filters.expenseTypeIds,
          paymentMethodIds: filters.paymentMethodIds,
          amountMin: filters.amountMin ? Number(filters.amountMin) : null,
          amountMax: filters.amountMax ? Number(filters.amountMax) : null,
          month: filters.month ? Number(filters.month) : null,
          year: filters.year ? Number(filters.year) : null,
          dateFrom: filters.dateFrom || null,
          dateTo: filters.dateTo || null,
          sort: filters.sort,
        },
      },
    );
    if (error) throw error;
    const result = data as {
      rows?: TransactionRow[];
      hasMore?: boolean;
      totalAmount?: number | string;
      totalCount?: number;
    };
    return {
      rows: (result.rows || []).map(mapTransactionRow),
      hasMore: Boolean(result.hasMore),
      totalAmount: Number(result.totalAmount || 0),
      totalCount: Number(result.totalCount || 0),
      page,
    };
  }
  const { data, error } = await supabase.rpc('list_family_transactions', {
    p_family_id: familyId,
    p_limit: pageSize,
    p_offset: page * pageSize,
    p_query: filters.query,
    p_transaction_type: filters.transactionType,
    p_status: filters.status,
    p_purpose_ids: filters.purposeIds,
    p_expense_type_ids: filters.expenseTypeIds,
    p_payment_method_ids: filters.paymentMethodIds,
    p_amount_min: filters.amountMin ? Number(filters.amountMin) : null,
    p_amount_max: filters.amountMax ? Number(filters.amountMax) : null,
    p_month: filters.month ? Number(filters.month) : null,
    p_year: filters.year ? Number(filters.year) : null,
    p_date_from: filters.dateFrom || null,
    p_date_to: filters.dateTo || null,
    p_sort: filters.sort,
  });
  if (error) throw error;
  const result = data as unknown as {
    rows?: TransactionRow[];
    hasMore?: boolean;
    totalAmount?: number | string;
    totalCount?: number;
  };
  return {
    rows: (result.rows || []).map(mapTransactionRow),
    hasMore: Boolean(result.hasMore),
    totalAmount: Number(result.totalAmount || 0),
    totalCount: Number(result.totalCount || 0),
    page,
  };
}

export async function fetchTransaction(familyId: string, id: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('family_id', familyId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return data ? mapTransactionRow(data as TransactionRow) : null;
}

export async function fetchTransactionYears(familyId: string) {
  const { data, error } = await supabase.rpc('get_transaction_years', {
    p_family_id: familyId,
  });
  if (error) throw error;
  return ((data || []) as number[]).map(String);
}

export async function fetchDashboardTransactions(
  familyId: string,
  dateFrom: string,
  dateTo: string,
): Promise<Transaction[]> {
  const pageSize = 1000;
  const rows: TransactionRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('family_id', familyId)
      .eq('status', 'Thực tế')
      .is('deleted_at', null)
      .gte('transaction_date', dateFrom)
      .lte('transaction_date', dateTo)
      .order('transaction_date', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;

    const page = (data || []) as TransactionRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }

  return rows.map(mapTransactionRow);
}

export async function fetchDashboardDueTransactions(
  familyId: string,
  today: string,
): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('family_id', familyId)
    .eq('status', 'Dự kiến')
    .is('deleted_at', null)
    .lte('transaction_date', today)
    .order('transaction_date', { ascending: true })
    .order('id', { ascending: true })
    .limit(20);
  if (error) throw error;
  return ((data || []) as TransactionRow[]).map(mapTransactionRow);
}

export async function fetchDeletedTransactionPage(familyId: string, filters: ServerTransactionFilters, page: number, pageSize = 50) {
  const { data, error } = await supabase.rpc('list_deleted_transactions', { p_family_id: familyId, p_limit: pageSize, p_offset: page * pageSize, p_query: filters.query, p_transaction_type: filters.transactionType, p_purpose_ids: filters.purposeIds, p_expense_type_ids: filters.expenseTypeIds, p_payment_method_ids: filters.paymentMethodIds, p_amount_min: filters.amountMin ? Number(filters.amountMin) : null, p_amount_max: filters.amountMax ? Number(filters.amountMax) : null, p_month: filters.month ? Number(filters.month) : null, p_year: filters.year ? Number(filters.year) : null, p_date_from: filters.dateFrom || null, p_date_to: filters.dateTo || null });
  if (error) throw error;
  const result = data as unknown as { rows?: TransactionRow[]; hasMore?: boolean; totalCount?: number };
  return { rows: (result.rows || []).map(mapTransactionRow), hasMore: Boolean(result.hasMore), totalCount: Number(result.totalCount || 0), page };
}

export type DashboardSummary = {
  totalIncome: number;
  totalExpense: number;
  byPurpose: Array<{ name: string; nameEn?: string; value: number }>;
  byExpenseType: Array<{ name: string; nameEn?: string; value: number }>;
  incomeByPurpose: Array<{ name: string; nameEn?: string; value: number }>;
  incomeByExpenseType: Array<{ name: string; nameEn?: string; value: number }>;
  trend: Array<{ m: string; v: number }>;
  recentTransactions: Transaction[];
  dueTransactions: Transaction[];
};

export type DashboardTrends = {
  income: Array<{ m: string; v: number }>;
  expense: Array<{ m: string; v: number }>;
};

export async function fetchDashboardTrends(
  familyId: string,
  year: number,
  month: number,
): Promise<DashboardTrends> {
  const { data, error } = await supabase.rpc('get_dashboard_trends', {
    p_family_id: familyId,
    p_year: year,
    p_month: month,
  });
  if (error) throw error;
  const result = data as DashboardTrends;
  return {
    income: (result.income || []).map((item) => ({ m: item.m, v: Number(item.v) })),
    expense: (result.expense || []).map((item) => ({ m: item.m, v: Number(item.v) })),
  };
}

export async function fetchDashboardSummary(
  familyId: string,
  year: number,
  month: number,
): Promise<DashboardSummary> {
  const { data, error } = await supabase.rpc('get_dashboard_summary', {
    p_family_id: familyId,
    p_year: year,
    p_month: month,
  });
  if (error) throw error;
  const result = data as unknown as Omit<
    DashboardSummary,
    'recentTransactions' | 'dueTransactions'
  > & {
    recentTransactions?: TransactionRow[];
    dueTransactions?: TransactionRow[];
  };
  return {
    totalIncome: Number(result.totalIncome || 0),
    totalExpense: Number(result.totalExpense || 0),
    byPurpose: (result.byPurpose || []).map((item) => ({
      name: item.name,
      nameEn: item.nameEn,
      value: Number(item.value),
    })),
    byExpenseType: (result.byExpenseType || []).map((item) => ({
      name: item.name,
      nameEn: item.nameEn,
      value: Number(item.value),
    })),
    incomeByPurpose: (result.incomeByPurpose || []).map((item) => ({ name: item.name, nameEn: item.nameEn, value: Number(item.value) })),
    incomeByExpenseType: (result.incomeByExpenseType || []).map((item) => ({ name: item.name, nameEn: item.nameEn, value: Number(item.value) })),
    trend: (result.trend || []).map((item) => ({
      m: item.m,
      v: -Number(item.v),
    })),
    recentTransactions: (result.recentTransactions || []).map(
      mapTransactionRow,
    ),
    dueTransactions: (result.dueTransactions || []).map(mapTransactionRow),
  };
}
