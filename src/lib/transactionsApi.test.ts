import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchDashboardAggregate,
  fetchTransactionPage,
  REMOTE_TRANSACTION_REFRESH_INTERVAL_MS,
} from './transactionsApi';

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock('./supabase', () => ({
  supabase: { rpc: rpcMock },
}));

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
  afterEach(() => {
    rpcMock.mockReset();
  });

  it('uses the exclusion-aware family RPC without invoking semantic search', async () => {
    rpcMock.mockResolvedValueOnce({
      data: { rows: [], hasMore: false, totalAmount: 0, totalCount: 0 },
      error: null,
    });

    await fetchTransactionPage(
      '11111111-1111-4111-8111-111111111111',
      filters,
      0,
    );

    expect(rpcMock).toHaveBeenCalledWith('list_family_transactions_v2', {
      p_family_id: '11111111-1111-4111-8111-111111111111',
      p_limit: 50,
      p_offset: 0,
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
});

describe('remote transaction refresh', () => {
  it('refreshes external transaction changes within a bounded interval', () => {
    expect(REMOTE_TRANSACTION_REFRESH_INTERVAL_MS).toBe(30_000);
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
});
