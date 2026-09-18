import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FeedbackProvider } from '../components/Feedback';
import { useApp } from '../context/AppContext';
import type { AutomaticTransactionDefault } from '../lib/automaticTransactionDefaults';
import { Assets, assetError } from './Assets';

vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));
vi.mock('../lib/supabase', () => ({ isSupabaseConfigured: false }));

const familyId = 'family-assets-ui';
const scrollIntoView = vi.fn();
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
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('dịch đúng lỗi RPC catalog từ object Supabase', () => {
    expect(assetError({ code: 'P0001', message: 'CATALOG_NOT_READY' }, false, 'fallback')).toContain('bỏ chọn tự tạo giao dịch');
    expect(assetError({ code: 'P0001', message: 'CATALOG_NOT_READY' }, false, 'fallback')).toContain('chỉ lưu tài sản');
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
    fireEvent.click(screen.getByRole('tab', { name: 'Vàng' }));
    const goldArticle = screen.getByRole('heading', { name: '1 chỉ', level: 4 }).closest('article')!;

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
    fireEvent.click(screen.getByRole('tab', { name: 'Vàng' }));

    fireEvent.click(within(screen.getByRole('tabpanel', { name: 'Vàng' })).getAllByRole('button', { name: 'Thêm vàng' })[0]!);
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

  it('bán theo tổng số vàng và tự phân bổ lịch sử qua nhiều lô', async () => {
    const secondGoldAsset = {
      ...goldAsset,
      id: 'gold-ui-2',
      purchaseDate: '2026-02-01',
      quantityChi: 2,
      remainingQuantityChi: 2,
      purchasePricePerChi: 10_000_000,
    };
    localStorage.setItem(`family-expense:gold-assets:${familyId}`, JSON.stringify([goldAsset, secondGoldAsset]));
    const { setTransactions } = renderAssets([]);
    fireEvent.click(screen.getByRole('tab', { name: 'Vàng' }));

    expect(screen.getByText('Số vàng hiện có')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Bán vàng' }));
    const saleHeading = await screen.findByRole('heading', { name: 'Bán theo tổng số vàng hiện có' });
    const saleForm = saleHeading.closest('section');
    const goldSection = screen.getByRole('region', { name: 'Vàng' });
    expect(saleForm?.nextElementSibling).toBe(goldSection);
    fireEvent.change(screen.getByLabelText('Số lượng (chỉ)', { exact: false }), { target: { value: '1.5' } });
    fireEvent.change(screen.getByLabelText('Giá bán / chỉ (VND)', { exact: false }), { target: { value: '9000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Bán và ghi thu nhập' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Bán và ghi nhận' }));

    await waitFor(() => expect(screen.getByText('Đã ghi nhận bán vàng.')).toBeInTheDocument());
    const savedAssets = JSON.parse(localStorage.getItem(`family-expense:gold-assets:${familyId}`) || '[]');
    const savedSales = JSON.parse(localStorage.getItem(`family-expense:gold-sales:${familyId}`) || '[]');
    expect(savedAssets).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'gold-ui', remainingQuantityChi: 0, status: 'sold' }),
      expect.objectContaining({ id: 'gold-ui-2', remainingQuantityChi: 1.5, status: 'active' }),
    ]));
    expect(savedSales).toHaveLength(2);
    expect(savedSales.map((sale: { quantityChi: number }) => sale.quantityChi)).toEqual([1, 0.5]);
    expect(savedSales.every((sale: { transactionId: string }) => Boolean(sale.transactionId))).toBe(true);
    expect(screen.getByText('Lịch sử bán (1)')).toBeInTheDocument();
    await waitFor(() => expect(setTransactions).toHaveBeenCalledTimes(1));
    const update = setTransactions.mock.calls[0]![0] as (items: Array<Record<string, unknown>>) => Array<Record<string, unknown>>;
    expect(update([])[0]).toMatchObject({ transactionType: 'Thu nhập', amount: 13_500_000, sourceReference: expect.stringContaining('asset:gold:aggregate:sale:') });
  });

  it('khôi phục toàn bộ lần bán tổng hợp và giao dịch thu nhập liên kết', async () => {
    const soldAsset = { ...goldAsset, remainingQuantityChi: 0.5 };
    localStorage.setItem(`family-expense:gold-assets:${familyId}`, JSON.stringify([soldAsset]));
    localStorage.setItem(`family-expense:gold-sales:${familyId}`, JSON.stringify([{
      id: 'sale-restore-ui',
      familyId,
      goldAssetId: goldAsset.id,
      saleDate: '2026-02-01',
      quantityChi: 0.5,
      salePricePerChi: 8_500_000,
      amount: 4_250_000,
      paymentMethodId: 'payment-bank',
      transactionId: 'gold-sale-restore-ui',
    }]));
    const linkedTransaction = { id: 'gold-sale-restore-ui', source: 'asset', sourceReference: 'asset:gold:aggregate:sale:restore' };
    const { setTransactions } = renderAssets([linkedTransaction]);
    fireEvent.click(screen.getByRole('tab', { name: 'Vàng' }));
    fireEvent.click(screen.getByText('Lịch sử bán (1)'));
    fireEvent.click(screen.getByRole('button', { name: 'Khôi phục lần bán' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Khôi phục' }));

    await waitFor(() => expect(screen.getByText('Đã khôi phục lần bán vàng.')).toBeInTheDocument());
    expect(JSON.parse(localStorage.getItem(`family-expense:gold-assets:${familyId}`) || '[]')).toEqual([
      expect.objectContaining({ id: goldAsset.id, remainingQuantityChi: 1, status: 'active' }),
    ]);
    expect(JSON.parse(localStorage.getItem(`family-expense:gold-sales:${familyId}`) || '[]')).toEqual([]);
    await waitFor(() => expect(setTransactions).toHaveBeenCalledTimes(1));
    const update = setTransactions.mock.calls[0]![0] as (items: typeof linkedTransaction[]) => typeof linkedTransaction[];
    expect(update([linkedTransaction])).toEqual([]);
  });

  it('hiển thị sổ tiết kiệm và vàng trong hai tab riêng', () => {
    localStorage.setItem(`family-expense:savings-accounts:${familyId}`, JSON.stringify([savingsAccount]));
    localStorage.setItem(`family-expense:gold-assets:${familyId}`, JSON.stringify([goldAsset]));
    renderAssets([]);

    const savingsTab = screen.getByRole('tab', { name: 'Sổ tiết kiệm' });
    const goldTab = screen.getByRole('tab', { name: 'Vàng' });
    const savingsPanel = screen.getByRole('tabpanel', { name: 'Sổ tiết kiệm' });
    const goldPanel = document.getElementById('assets-panel-gold')!;

    expect(savingsTab).toHaveAttribute('aria-selected', 'true');
    expect(goldTab).toHaveAttribute('aria-selected', 'false');
    expect(within(savingsPanel).getByText('ACB · Sổ cần xóa')).toBeInTheDocument();
    expect(goldPanel).toHaveAttribute('hidden');

    fireEvent.click(goldTab);

    expect(goldTab).toHaveAttribute('aria-selected', 'true');
    expect(savingsPanel).toHaveAttribute('hidden');
    expect(within(goldPanel).getByRole('heading', { name: '1 chỉ', level: 4 })).toBeInTheDocument();
  });

  it('phân biệt màu nút thêm sổ và thêm vàng theo loại tài sản', () => {
    renderAssets([]);

    const header = screen.getByRole('heading', { name: 'Tài sản' }).closest('header');
    expect(header).not.toBeNull();
    expect(within(header!).getByRole('button', { name: 'Thêm sổ' })).toHaveClass('asset-add-button', 'asset-add-savings');
    expect(within(header!).getByRole('button', { name: 'Thêm vàng' })).toHaveClass('asset-add-button', 'asset-add-gold');
  });

  it('căn đều hai nút thao tác vàng', () => {
    localStorage.setItem(`family-expense:gold-assets:${familyId}`, JSON.stringify([goldAsset]));
    renderAssets([]);
    fireEvent.click(screen.getByRole('tab', { name: 'Vàng' }));

    const sellButton = screen.getByRole('button', { name: 'Bán vàng' });
    const goldSection = screen.getByRole('region', { name: 'Vàng' });
    const addButton = within(goldSection).getByRole('button', { name: 'Thêm vàng' });
    expect(sellButton).toHaveClass('w-full', 'justify-center');
    expect(addButton).toHaveClass('w-full', 'justify-center');
    expect(sellButton.parentElement).toHaveClass('grid', 'w-full', 'sm:w-64');
  });

  it('hiển thị phần cài đặt giá mua vào dùng chung rõ ràng', () => {
    renderAssets([]);
    fireEvent.click(screen.getByRole('tab', { name: 'Vàng' }));

    const pricePanel = screen.getByRole('heading', { name: 'Giá tiệm mua vào dùng chung' }).closest<HTMLElement>('.gold-price-panel');
    expect(pricePanel).not.toBeNull();
    expect(pricePanel).toHaveClass('gold-price-panel');
    expect(within(pricePanel!).getByRole('textbox', { name: 'Giá tiệm mua vào dùng chung / chỉ (VND)' })).toHaveClass('gold-price-input');
    expect(within(pricePanel!).getByRole('button', { name: 'Lưu giá dùng chung' })).toHaveClass('gold-price-submit');
    expect(within(pricePanel!).getByText('Chưa thiết lập')).toBeInTheDocument();
  });

  it('hiển thị lô vàng theo holding card gọn, có phân cấp số liệu và nút icon', () => {
    localStorage.setItem(`family-expense:savings-accounts:${familyId}`, JSON.stringify([savingsAccount]));
    localStorage.setItem(`family-expense:savings-movements:${familyId}`, JSON.stringify([{
      id: 'movement-hidden-ui',
      familyId,
      savingsAccountId: savingsAccount.id,
      movementType: 'opening',
      amount: savingsAccount.principal,
      balanceAfter: savingsAccount.currentBalance,
      movementDate: savingsAccount.openedOn,
      paymentMethodId: 'payment-bank',
      transactionId: 'savings-opening-ui',
    }]));
    localStorage.setItem(`family-expense:gold-assets:${familyId}`, JSON.stringify([goldAsset]));
    renderAssets([]);

    const savingsArticle = screen.getByText('ACB · Sổ cần xóa').closest('article')!;

    expect(savingsArticle).toHaveClass('p-3', 'sm:p-4');
    expect(savingsArticle.querySelectorAll('.asset-stat-card')).toHaveLength(3);
    const interestProgress = within(savingsArticle).getByRole('progressbar', { name: 'Tiến độ lãi ACB · Sổ cần xóa' });
    expect(interestProgress).toHaveAttribute('aria-valuemin', '0');
    expect(interestProgress).toHaveAttribute('aria-valuemax', '100');
    expect(interestProgress).toHaveAttribute('aria-valuenow', '100');
    expect(within(savingsArticle).queryByText(/Lịch sử sổ/)).not.toBeInTheDocument();
    const savingsActions = within(savingsArticle).getByRole('group', { name: 'Thao tác sổ tiết kiệm' });
    expect(savingsActions.parentElement).toHaveClass('asset-stat-row', 'grid-cols-2');
    expect(savingsActions).toHaveClass('col-span-2');
    expect(within(savingsActions).getAllByRole('button')).toHaveLength(3);
    expect(Array.from(savingsActions.querySelectorAll('button')).map((button) => button.getAttribute('aria-label'))).toEqual(['Tất toán', 'Sửa', 'Xóa']);
    expect(within(savingsActions).getByRole('button', { name: 'Sửa' })).toHaveClass('asset-action-button', 'asset-icon-action');
    expect(within(savingsActions).getByRole('button', { name: 'Tất toán' })).toHaveClass('asset-action-button', 'asset-icon-action');
    expect(within(savingsActions).getByRole('button', { name: 'Xóa' })).toHaveClass('asset-action-button', 'asset-icon-action');
    expect(within(savingsActions).getByRole('button', { name: 'Sửa' }).textContent).toBe('');
    expect(within(savingsActions).getByRole('button', { name: 'Sửa' })).toHaveAttribute('title', 'Sửa sổ tiết kiệm');

    fireEvent.click(screen.getByRole('tab', { name: 'Vàng' }));
    const goldArticle = screen.getByRole('heading', { name: '1 chỉ', level: 4 }).closest('article')!;

    expect(goldArticle).toHaveClass('asset-gold-row', 'rounded-2xl', 'p-3', 'sm:p-4');
    expect(goldArticle.querySelectorAll('.asset-stat-card')).toHaveLength(0);
    expect(goldArticle).not.toHaveTextContent('Giá tiệm mua vào');
    expect(within(goldArticle).getByText('Giá mua / chỉ')).toBeInTheDocument();
    expect(within(goldArticle).getByText('Giá bán ước tính')).toBeInTheDocument();
    expect(within(goldArticle).queryByText('Giá trị bán ước tính')).not.toBeInTheDocument();
    expect(within(goldArticle).getByText('8.000.000 ₫/chỉ')).toBeInTheDocument();
    const goldActions = within(goldArticle).getByRole('group', { name: 'Thao tác vàng' });
    expect(goldArticle.querySelector('.asset-row-footer')).not.toBeInTheDocument();
    expect(goldActions.closest('.asset-row-main')).toHaveClass('asset-row-main', 'grid', 'gap-3', 'grid-cols-[minmax(0,1fr)_auto]', 'md:grid-cols-[minmax(0,1fr)_minmax(18rem,0.75fr)_auto]');
    expect(goldActions).toHaveClass('col-start-2', 'row-start-1', 'md:border-l');
    expect(within(goldActions).getAllByRole('button')).toHaveLength(2);
    expect(within(goldActions).getByRole('button', { name: 'Sửa' })).toHaveClass('asset-icon-action');
    expect(within(goldActions).getByRole('button', { name: 'Xóa' })).toHaveClass('asset-icon-action');
    expect(within(goldActions).getByRole('button', { name: 'Sửa' }).textContent).toBe('');
  });

  it('đưa tới form khi sửa sổ tiết kiệm hoặc lô vàng ở cuối danh sách', async () => {
    localStorage.setItem(`family-expense:savings-accounts:${familyId}`, JSON.stringify([savingsAccount]));
    localStorage.setItem(`family-expense:gold-assets:${familyId}`, JSON.stringify([goldAsset]));
    renderAssets([]);

    const savingsArticle = screen.getByText('ACB · Sổ cần xóa').closest('article')!;
    fireEvent.click(within(savingsArticle).getByRole('button', { name: 'Sửa' }));

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth', block: 'start' })));
    expect(document.activeElement).toBe(screen.getByLabelText('Ngân hàng'));

    fireEvent.click(screen.getByRole('tab', { name: 'Vàng' }));
    const goldArticle = screen.getByRole('heading', { name: '1 chỉ', level: 4 }).closest('article')!;
    fireEvent.click(within(goldArticle).getByRole('button', { name: 'Sửa' }));

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(2));
    expect(document.activeElement).toBe(screen.getByLabelText('Ngày mua'));
  });

  it('cho phép nhập lãi suất thập phân trên bàn phím điện thoại', () => {
    renderAssets([]);
    fireEvent.click(screen.getAllByRole('button', { name: /^Thêm sổ$/ })[0]!);

    const rateInput = screen.getByLabelText('Lãi suất năm (%)');
    expect(rateInput).toHaveAttribute('type', 'text');
    expect(rateInput).toHaveAttribute('inputmode', 'decimal');
    expect(rateInput).not.toHaveAttribute('placeholder');

    fireEvent.change(rateInput, { target: { value: '8,2' } });
    expect(rateInput).toHaveValue('8.2');
  });
});
