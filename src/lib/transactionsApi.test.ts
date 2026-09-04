import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchTransactionPage } from './transactionsApi';

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

  it('uses the normal family RPC without invoking semantic search', async () => {
    rpcMock.mockResolvedValueOnce({
      data: { rows: [], hasMore: false, totalAmount: 0, totalCount: 0 },
      error: null,
    });

    await fetchTransactionPage(
      '11111111-1111-4111-8111-111111111111',
      filters,
      0,
    );

    expect(rpcMock).toHaveBeenCalledWith('list_family_transactions', {
      p_family_id: '11111111-1111-4111-8111-111111111111',
      p_limit: 50,
      p_offset: 0,
      p_query: 'quần áo',
      p_transaction_type: 'Chi tiêu',
      p_status: 'Thực tế',
      p_purpose_ids: [],
      p_expense_type_ids: ['22222222-2222-4222-8222-222222222222'],
      p_payment_method_ids: [],
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
