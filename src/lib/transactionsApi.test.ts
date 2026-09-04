import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchTransactionPage } from './transactionsApi';

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock('./supabase', () => ({
  supabase: { functions: { invoke: invokeMock } },
}));

const filters = {
  query: '',
  semanticQuery: 'mua đồ cho em bé',
  transactionType: '',
  status: '',
  purposeIds: [],
  expenseTypeIds: [],
  paymentMethodIds: [],
  amountMin: '',
  amountMax: '',
  month: '',
  year: '',
  dateFrom: '',
  dateTo: '',
  sort: 'date-desc',
};

describe('fetchTransactionPage semantic search', () => {
  afterEach(() => {
    invokeMock.mockReset();
  });

  it('attempts a bounded embedding batch before searching', async () => {
    invokeMock
      .mockResolvedValueOnce({
        data: { processed: 1, failed: 0, remainingHint: false },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { rows: [], hasMore: false, totalAmount: 0, totalCount: 0 },
        error: null,
      });

    await fetchTransactionPage(
      '11111111-1111-4111-8111-111111111111',
      filters,
      0,
    );

    expect(invokeMock).toHaveBeenNthCalledWith(
      1,
      'process-transaction-embeddings',
      {
        body: {
          familyId: '11111111-1111-4111-8111-111111111111',
          limit: 5,
        },
      },
    );
    expect(invokeMock).toHaveBeenNthCalledWith(
      2,
      'search-transactions-semantic',
      expect.objectContaining({
        body: expect.objectContaining({
          familyId: '11111111-1111-4111-8111-111111111111',
          semanticQuery: 'mua đồ cho em bé',
          query: 'mua đồ cho em bé',
        }),
      }),
    );
  });

  it('still runs semantic search when the optional backfill is resource-limited', async () => {
    invokeMock
      .mockRejectedValueOnce(new Error('WORKER_RESOURCE_LIMIT'))
      .mockResolvedValueOnce({
        data: { rows: [], hasMore: false, totalAmount: 0, totalCount: 0 },
        error: null,
      });

    await fetchTransactionPage(
      '11111111-1111-4111-8111-111111111111',
      filters,
      0,
    );

    expect(invokeMock).toHaveBeenNthCalledWith(
      2,
      'search-transactions-semantic',
      expect.objectContaining({
        body: expect.objectContaining({
          query: 'mua đồ cho em bé',
          semanticQuery: 'mua đồ cho em bé',
        }),
      }),
    );
  });
});
