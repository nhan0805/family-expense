import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FeedbackProvider } from '../components/Feedback';
import { Assets } from './Assets';

const mocks = vi.hoisted(() => ({
  useApp: vi.fn(),
  fetchAssetData: vi.fn(),
  fetchAssetSummary: vi.fn(),
  fetchAutomaticTransactionDefaults: vi.fn(),
  upsertSavingsAccount: vi.fn(),
  archiveGoldAsset: vi.fn(),
  archiveSavingsAccount: vi.fn(),
  deleteGoldAsset: vi.fn(),
  deleteSavingsAccount: vi.fn(),
  recordGoldSale: vi.fn(),
  restoreGoldSale: vi.fn(),
  recordSavingsMovement: vi.fn(),
  settleSavingsAccount: vi.fn(),
  setGoldBuybackPrice: vi.fn(),
  upsertGoldAsset: vi.fn(),
}));

vi.mock('../context/AppContext', () => ({ useApp: mocks.useApp }));
vi.mock('../lib/supabase', () => ({ isSupabaseConfigured: true }));
vi.mock('../lib/assetsApi', () => mocks);
vi.mock('../lib/automaticTransactionDefaultsApi', () => ({
  fetchAutomaticTransactionDefaults: mocks.fetchAutomaticTransactionDefaults,
}));

const familyId = 'family-assets-cloud-ui';
const scrollIntoView = vi.fn();
const assetData = {
  savingsAccounts: [],
  savingsMovements: [],
  goldAssets: [],
  goldSales: [],
  goldBuybackPricePerChi: null,
};
const assetSummary = {
  netCash: 0,
  savingsTotal: 0,
  goldEstimatedTotal: 0,
  goldCost: 0,
  goldQuantityChi: 0,
  savingsCount: 0,
  goldCount: 0,
  goldMissingEstimateCount: 0,
  goldBuybackPricePerChi: null,
  savings: [],
  gold: [],
};

function renderAssets() {
  mocks.useApp.mockReturnValue({
    familyId,
    currentUserId: 'user-cloud-ui',
    currentUserRole: 'owner',
    purposes: [{ id: 'purpose-investment', name: 'Đầu tư' }],
    expenseTypes: [{ id: 'expense-savings', name: 'Gửi tiết kiệm' }],
    paymentMethods: [{ id: 'payment-bank', name: 'Chuyển khoản' }],
    transactions: [],
    setTransactions: vi.fn(),
    online: true,
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<FeedbackProvider><QueryClientProvider client={client}><Assets /></QueryClientProvider></FeedbackProvider>);
}

async function submitNewSavingsBook() {
  await screen.findByRole('button', { name: 'Lưu sổ' });
  fireEvent.change(screen.getByLabelText('Ngân hàng'), { target: { value: 'Timo' } });
  fireEvent.change(screen.getByLabelText('Tên sổ'), { target: { value: 'Timo' } });
  fireEvent.change(screen.getByLabelText(/Tiền gốc \(VND\)/), { target: { value: '50000000' } });
  fireEvent.change(screen.getByLabelText('Lãi suất năm (%)'), { target: { value: '8.2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu sổ' }));
  const dialog = await screen.findByRole('alertdialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Tạo và ghi giao dịch' }));
}

describe('Tài sản — luồng Supabase', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });
    mocks.fetchAssetData.mockResolvedValue(assetData);
    mocks.fetchAssetSummary.mockResolvedValue(assetSummary);
    mocks.fetchAutomaticTransactionDefaults.mockResolvedValue([]);
    mocks.upsertSavingsAccount.mockReset();
    mocks.useApp.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('hiển thị hướng xử lý khi RPC trả lỗi danh mục dạng object', async () => {
    mocks.upsertSavingsAccount.mockRejectedValue({ code: 'P0001', message: 'CATALOG_NOT_READY' });
    renderAssets();
    fireEvent.click(await screen.findAllByRole('button', { name: 'Thêm sổ' }).then((buttons) => buttons[0]!));

    await submitNewSavingsBook();

    await waitFor(() => {
      expect(
        screen.getAllByRole('alert').some((alert) =>
          alert.textContent?.includes('bỏ chọn tự tạo giao dịch'),
        ),
      ).toBe(true);
    });
  });

  it('vẫn đóng form và báo đã lưu khi chỉ việc làm mới dữ liệu thất bại', async () => {
    mocks.upsertSavingsAccount.mockResolvedValue({ account: {} });
    mocks.fetchAssetData.mockResolvedValueOnce(assetData).mockRejectedValue(new Error('refresh failed'));
    mocks.fetchAssetSummary.mockResolvedValueOnce(assetSummary).mockRejectedValue(new Error('refresh failed'));
    renderAssets();
    fireEvent.click(await screen.findAllByRole('button', { name: 'Thêm sổ' }).then((buttons) => buttons[0]!));

    await submitNewSavingsBook();

    await waitFor(() => expect(screen.getByText('Đã lưu sổ tiết kiệm.')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Lưu sổ' })).not.toBeInTheDocument();
  });

  it('cho phép lưu lô vàng mà không cần tạo giao dịch tự động', async () => {
    mocks.upsertGoldAsset.mockResolvedValue({ asset: {} });
    renderAssets();
    fireEvent.click(await screen.findByRole('tab', { name: 'Vàng' }));
    fireEvent.click(within(screen.getByRole('tabpanel', { name: 'Vàng' })).getAllByRole('button', { name: 'Thêm vàng' })[0]!);

    fireEvent.change(screen.getByLabelText('Số lượng (chỉ)'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Giá mua / chỉ (VND)'), { target: { value: '10000000' } });
    fireEvent.click(screen.getByLabelText('Tự tạo giao dịch chi tiền mua vàng'));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu vàng' }));

    await waitFor(() => expect(mocks.upsertGoldAsset).toHaveBeenCalledWith(
      familyId,
      expect.objectContaining({ quantityChi: 1, purchasePricePerChi: 10_000_000 }),
      undefined,
      false,
    ));
    await waitFor(() => expect(screen.getByText('Đã lưu vàng.')).toBeInTheDocument());
  });
});
