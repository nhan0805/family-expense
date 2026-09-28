import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchDashboardAggregate,
  fetchDashboardAggregates,
  fetchDashboardDueTransactions,
  fetchTransactionPage,
  REMOTE_TRANSACTION_REFRESH_INTERVAL_MS,
} from './transactionsApi';

const { fromMock, rpcMock } = vi.hoisted(() => ({ fromMock: vi.fn(), rpcMock: vi.fn() }));

vi.mock('./supabase', () => ({
  supabase: { from: fromMock, rpc: rpcMock },
}));

afterEach(() => {
  fromMock.mockReset();
  rpcMock.mockReset();
});

const filters = {
  query: 'quần áo',
  transactionType: 'Chi tiêu',
  status: 'Thực tế',
  purposeIds: [],
  expenseTypeIds: ['22222222-2222-4222-8222-222222222222'],
  paymentMethodIds: [],
  excludePurposeIds: [],
  excludeExpenseTypeIds: [],
  excludePaymentMethodIds: [],
  amountMin: '',
  amountMax: '',
  month: '09',
  year: '2026',
  dateFrom: '',
  dateTo: '',
  sort: 'date-desc',
};

describe('fetchTransactionPage keyword search', () => {
  it('uses cursor pagination for the common date-sorted list', async () => {
    rpcMock.mockResolvedValueOnce({
      data: { rows: [], hasMore: false, nextCursor: null, totalAmount: 0, totalCount: 0 },
      error: null,
    });

    await fetchTransactionPage(
      '11111111-1111-4111-8111-111111111111',
      filters,
      0,
    );

    expect(rpcMock).toHaveBeenCalledWith('list_family_transactions_v3', {
      p_family_id: '11111111-1111-4111-8111-111111111111',
      p_limit: 50,
      p_cursor_date: null,
      p_cursor_created_at: null,
      p_cursor_id: null,
      p_include_totals: true,
      p_query: 'quần áo',
      p_transaction_type: 'Chi tiêu',
      p_status: 'Thực tế',
      p_purpose_ids: [],
      p_expense_type_ids: ['22222222-2222-4222-8222-222222222222'],
      p_payment_method_ids: [],
      p_exclude_purpose_ids: [],
      p_exclude_expense_type_ids: [],
      p_exclude_payment_method_ids: [],
      p_amount_min: null,
      p_amount_max: null,
      p_month: 9,
      p_year: 2026,
      p_date_from: null,
      p_date_to: null,
      p_sort: 'date-desc',
    });
  });

  it('keeps the offset RPC for non-date sorting', async () => {
    rpcMock.mockResolvedValueOnce({
      data: { rows: [], hasMore: false, totalAmount: 0, totalCount: 0 },
      error: null,
    });

    await fetchTransactionPage(
      '11111111-1111-4111-8111-111111111111',
      { ...filters, sort: 'amount-desc' },
      2,
    );

    expect(rpcMock).toHaveBeenCalledWith('list_family_transactions_v2', expect.objectContaining({
      p_offset: 100,
      p_sort: 'amount-desc',
    }));
  });
});

describe('remote transaction refresh', () => {
  it('refreshes external transaction changes within a bounded interval', () => {
    expect(REMOTE_TRANSACTION_REFRESH_INTERVAL_MS).toBe(30_000);
  });
});

describe('fetchDashboardDueTransactions', () => {
  it('loads every due transaction instead of stopping at the first 20 rows', async () => {
    const rows = Array.from({ length: 1001 }, (_, index) => ({
      id: `transaction-${index + 1}`,
      family_id: '11111111-1111-4111-8111-111111111111',
      transaction_date: '2026-09-01',
      transaction_type: 'Chi tiêu' as const,
      status: 'Dự kiến' as const,
      description: `Giao dịch ${index + 1}`,
      amount: 100_000,
      purpose_id: '22222222-2222-4222-8222-222222222222',
      expense_type_id: '33333333-3333-4333-8333-333333333333',
      beneficiary_id: null,
      payment_method_id: null,
      note: null,
      source: 'manual' as const,
      source_reference: null,
      ai_generated: false,
      created_by: '44444444-4444-4444-8444-444444444444',
      created_at: '2026-09-01T00:00:00.000Z',
      deleted_at: null,
    }));
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      lte: vi.fn(),
      order: vi.fn(),
      range: vi.fn(),
    };
    Object.values(query).forEach((method) => method.mockReturnValue(query));
    query.range.mockImplementation((from: number, to: number) => Promise.resolve({
      data: rows.slice(from, to + 1),
      error: null,
    }));
    fromMock.mockReturnValue(query);

    const result = await fetchDashboardDueTransactions(
      '11111111-1111-4111-8111-111111111111',
      '2026-09-29',
    );

    expect(result).toHaveLength(1001);
    expect(result.at(-1)?.description).toBe('Giao dịch 1001');
    expect(query.range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(query.range).toHaveBeenNthCalledWith(2, 1000, 1999);
  });
});

describe('fetchDashboardAggregate', () => {
  it('maps server aggregates without loading transaction rows', async () => {
    rpcMock.mockResolvedValueOnce({
      data: {
        totalIncome: '1000000',
        totalExpense: '250000',
        byPurpose: [{ id: 'p1', name: 'Gia đình', value: '250000' }],
        byExpenseType: [],
        incomeByPurpose: [],
        incomeByExpenseType: [],
        monthlyTrend: [{ key: '2026-09', expense: '250000', income: '1000000', net: '750000' }],
        monthlyCategories: [{ month: '2026-09', id: 'e1', value: '250000' }],
      },
      error: null,
    });

    const result = await fetchDashboardAggregate(
      '11111111-1111-4111-8111-111111111111',
      '2026-09-01',
      '2026-09-30',
    );

    expect(rpcMock).toHaveBeenCalledWith('get_dashboard_aggregate', {
      p_family_id: '11111111-1111-4111-8111-111111111111',
      p_date_from: '2026-09-01',
      p_date_to: '2026-09-30',
    });
    expect(result.totalExpense).toBe(250000);
    expect(result.monthlyTrend[0]?.net).toBe(750000);
  });

  it('loads chart, selected and comparison ranges independently', async () => {
    rpcMock.mockResolvedValue({ data: {}, error: null });

    await fetchDashboardAggregates(
      '11111111-1111-4111-8111-111111111111',
      {
        chart: { from: '2025-10-01', to: '2026-09-30' },
        selected: { from: '2026-01-01', to: '2026-12-31' },
        comparison: { from: '2025-01-01', to: '2025-12-31' },
      },
    );

    expect(rpcMock).toHaveBeenCalledTimes(3);
    expect(rpcMock.mock.calls.map(([, args]) => [args.p_date_from, args.p_date_to])).toEqual([
      ['2025-10-01', '2026-09-30'],
      ['2026-01-01', '2026-12-31'],
      ['2025-01-01', '2025-12-31'],
    ]);
  });

  it('deduplicates identical dashboard ranges', async () => {
    rpcMock.mockResolvedValue({ data: {}, error: null });

    await fetchDashboardAggregates(
      '11111111-1111-4111-8111-111111111111',
      {
        chart: { from: '2026-01-01', to: '2026-12-31' },
        selected: { from: '2026-01-01', to: '2026-12-31' },
        comparison: { from: '2025-01-01', to: '2025-12-31' },
      },
    );

    expect(rpcMock).toHaveBeenCalledTimes(2);
  });
});
