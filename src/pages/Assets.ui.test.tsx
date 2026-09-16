import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FeedbackProvider } from '../components/Feedback';
import { useApp } from '../context/AppContext';
import type { AutomaticTransactionDefault } from '../lib/automaticTransactionDefaults';
import { Assets } from './Assets';

vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));
vi.mock('../lib/supabase', () => ({ isSupabaseConfigured: false }));

const familyId = 'family-assets-ui';
const savingsAccount = {
  id: 'savings-ui',
  familyId,
  bankName: 'ACB',
  name: 'Sổ cần xóa',
  principal: 20_000_000,
  currentBalance: 20_000_000,
  annualInterestRate: 5,
  termMonths: 6,
  openedOn: '2026-01-01',
  maturityOn: '2026-07-01',
  interestMethod: 'end_of_term' as const,
  status: 'active' as const,
  note: null,
};
const goldAsset = {
  id: 'gold-ui',
  familyId,
  purchaseDate: '2026-01-01',
  quantityChi: 1,
  remainingQuantityChi: 1,
  purchasePricePerChi: 8_000_000,
  estimatedSellPricePerChi: 8_500_000,
  status: 'active' as const,
  transactionId: 'gold-purchase-ui',
  note: null,
};

function renderAssets(
  transactions: Array<Record<string, unknown>>,
  setTransactions = vi.fn(),
  automaticDefaults?: AutomaticTransactionDefault[],
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (automaticDefaults) queryClient.setQueryData(['automatic-transaction-defaults', familyId], automaticDefaults);
  vi.mocked(useApp).mockReturnValue({
    familyId,
    currentUserId: 'user-ui',
    currentUserRole: 'owner',
    purposes: [{ id: 'purpose-investment', name: 'Đầu tư' }],
    expenseTypes: [{ id: 'expense-investment', name: 'Đầu tư vàng' }],
    paymentMethods: [{ id: 'payment-bank', name: 'Chuyển khoản' }],
    transactions,
    setTransactions,
    online: true,
  } as unknown as ReturnType<typeof useApp>);
  return { setTransactions, ...render(<FeedbackProvider><QueryClientProvider client={queryClient}><Assets /></QueryClientProvider></FeedbackProvider>) };
}

describe('Tài sản', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('xóa sổ tiết kiệm cùng giao dịch liên kết sau khi xác nhận', async () => {
    localStorage.setItem(`family-expense:savings-accounts:${familyId}`, JSON.stringify([savingsAccount]));
    localStorage.setItem(`family-expense:savings-movements:${familyId}`, JSON.stringify([{
      id: 'movement-ui',
      familyId,
      savingsAccountId: savingsAccount.id,
      movementType: 'opening',
      amount: savingsAccount.principal,
      balanceAfter: savingsAccount.currentBalance,
      movementDate: savingsAccount.openedOn,
      paymentMethodId: 'payment-bank',
      transactionId: 'savings-opening-ui',
    }]));
    const linkedTransaction = {
      id: 'savings-opening-ui',
      source: 'asset',
      sourceReference: 'asset:savings:savings-ui:opening',
    };
    const { setTransactions } = renderAssets([linkedTransaction]);
    const accountArticle = screen.getByText('ACB · Sổ cần xóa').closest('article')!;

    fireEvent.click(within(accountArticle).getByRole('button', { name: 'Xóa' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('toàn bộ lịch sử phát sinh');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa sổ' }));

    await waitFor(() => expect(setTransactions).toHaveBeenCalledTimes(1));
    const update = setTransactions.mock.calls[0]![0] as (items: typeof linkedTransaction[]) => typeof linkedTransaction[];
    expect(update([linkedTransaction])).toEqual([]);
    expect(JSON.parse(localStorage.getItem(`family-expense:savings-accounts:${familyId}`) || '[]')).toEqual([]);
    expect(JSON.parse(localStorage.getItem(`family-expense:savings-movements:${familyId}`) || '[]')).toEqual([]);
  });

  it('xóa lô vàng cùng lịch sử bán và giao dịch liên kết sau khi xác nhận', async () => {
    localStorage.setItem(`family-expense:gold-assets:${familyId}`, JSON.stringify([goldAsset]));
    localStorage.setItem(`family-expense:gold-sales:${familyId}`, JSON.stringify([{
      id: 'sale-ui',
      familyId,
      goldAssetId: goldAsset.id,
      saleDate: '2026-02-01',
      quantityChi: 0.25,
      salePricePerChi: 8_500_000,
      amount: 2_125_000,
      paymentMethodId: 'payment-bank',
      transactionId: 'gold-sale-ui',
    }]));
    const linkedTransactions = [
      { id: 'gold-purchase-ui', source: 'asset', sourceReference: 'asset:gold:gold-ui:purchase' },
      { id: 'gold-sale-ui', source: 'asset', sourceReference: 'asset:gold:gold-ui:sale:sale-ui' },
      { id: 'other', source: 'asset', sourceReference: 'asset:gold:other:purchase' },
    ];
    const { setTransactions } = renderAssets(linkedTransactions);
    const goldArticle = screen.getByText('1 / 1 chỉ').closest('article')!;

    fireEvent.click(within(goldArticle).getByRole('button', { name: 'Xóa' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa vàng' }));

    await waitFor(() => expect(setTransactions).toHaveBeenCalledTimes(1));
    const update = setTransactions.mock.calls[0]![0] as (items: typeof linkedTransactions) => typeof linkedTransactions;
    expect(update(linkedTransactions)).toEqual([linkedTransactions[2]]);
    expect(JSON.parse(localStorage.getItem(`family-expense:gold-assets:${familyId}`) || '[]')).toEqual([]);
    expect(JSON.parse(localStorage.getItem(`family-expense:gold-sales:${familyId}`) || '[]')).toEqual([]);
  });

  it('dùng cấu hình giao dịch tự động đã lưu khi tạo lô vàng', async () => {
    const automaticDefaults = [
      'savings_opening',
      'savings_interest',
      'savings_withdrawal',
      'savings_fee',
      'savings_settlement',
      'gold_purchase',
      'gold_sale',
    ].map((automationKey) => ({
      automationKey: automationKey as AutomaticTransactionDefault['automationKey'],
      purposeId: 'purpose-investment',
      expenseTypeId: 'expense-investment',
      paymentMethodId: 'payment-bank',
    }));
    const { setTransactions } = renderAssets([], vi.fn(), automaticDefaults);

    fireEvent.click(screen.getAllByRole('button', { name: 'Thêm vàng' })[0]!);
    fireEvent.change(screen.getByLabelText('Số lượng (chỉ)'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Giá mua / chỉ (VND)'), { target: { value: '8.000.000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu vàng' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tạo và ghi giao dịch' }));

    await waitFor(() => expect(setTransactions).toHaveBeenCalledTimes(1));
    const update = setTransactions.mock.calls[0]![0] as (items: Array<Record<string, unknown>>) => Array<Record<string, unknown>>;
    expect(update([])[0]).toMatchObject({
      purposeId: 'purpose-investment',
      expenseTypeId: 'expense-investment',
      paymentMethodId: 'payment-bank',
      sourceReference: expect.stringMatching(/^asset:gold:/),
    });
  });
});
